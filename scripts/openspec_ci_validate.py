"""Validate OpenSpec requirements across a Git commit range."""
import argparse
import os
import re
import subprocess
import sys

# Importing the local guard must not leave a bytecode cache in the worktree.
sys.dont_write_bytecode = True
from openspec_guard import protected, validate


NAME_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
TRAILER_KEY = "OpenSpec-Change"


def git(*args, input_data=None, text=True):
    return subprocess.run(
        ["git", *args], input=input_data, text=text, capture_output=True, check=True
    ).stdout


def resolve_commit(label, ref):
    try:
        return git("rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}").strip()
    except subprocess.CalledProcessError as exc:
        raise ValueError(f"{label} does not resolve to a commit: {ref!r}") from exc


def changed_paths(commit):
    paths = git(
        "diff-tree", "--root", "-m", "--first-parent", "--no-commit-id", "--name-only",
        "-r", "--no-renames", "-z", commit, "--", text=False,
    )
    return [os.fsdecode(path) for path in paths.split(b"\0") if path]


def change_trailer_lines(message):
    lines = []
    for line in message.splitlines():
        key, separator, _ = line.partition(":")
        if separator and key.strip().casefold() == TRAILER_KEY.casefold():
            lines.append(line)
    return lines


def trailer(commit):
    message = git("show", "-s", "--format=%B", commit)
    parsed = git("interpret-trailers", "--parse", input_data=message)
    raw = change_trailer_lines(message)
    footer = change_trailer_lines(parsed)
    if len(raw) == len(footer) == 1:
        name = footer[0].removeprefix(f"{TRAILER_KEY}: ")
        if raw[0] == f"{TRAILER_KEY}: {name}" and NAME_RE.fullmatch(name):
            return name
    raise ValueError(f"{commit}: exactly one valid {TRAILER_KEY} trailer is required")


def validate_range(base, head):
    first = resolve_commit("BASE", base)
    last = resolve_commit("HEAD", head)
    names = set()
    for commit in git("rev-list", "--reverse", f"{first}..{last}", "--").splitlines():
        if not any(protected(path) for path in changed_paths(commit)):
            continue
        name = trailer(commit)
        names.add(name)
        print(f"{commit[:12]}: {name}", flush=True)
    for name in sorted(names):
        try:
            validate(name)
        except ValueError as exc:
            raise ValueError(f"{name}: {exc}") from exc
    subprocess.run(["openspec", "validate", "--all", "--strict", "--no-interactive"], check=True)
    print(f"Validated {len(names)} OpenSpec change(s) in {base}..{head}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    args = parser.parse_args()
    try:
        validate_range(args.base, args.head)
    except (subprocess.CalledProcessError, ValueError, OSError) as exc:
        detail = getattr(exc, "stderr", None) or str(exc)
        print(f"OpenSpec CI gate: {detail.strip()}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
