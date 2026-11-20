"""Local OpenSpec gate. Does not claim to prove temporal spec/code ordering."""
from pathlib import Path
import re
import subprocess
import sys


def protected(path):
    return not (path.startswith("openspec/") or Path(path).suffix in {".md", ".txt"})


def change_name(message):
    all_lines = re.findall(r"^OpenSpec-Change:.*$", message, re.MULTILINE)
    footer = subprocess.run(
        ["git", "interpret-trailers", "--parse"], input=message,
        text=True, capture_output=True, check=True,
    ).stdout
    trailers = re.findall(r"^OpenSpec-Change: (.*)$", footer, re.MULTILINE)
    if len(all_lines) != 1 or len(trailers) != 1:
        raise ValueError("Se exige exactamente un trailer OpenSpec-Change en el footer")
    name = trailers[0]
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
        raise ValueError("Nombre de cambio inválido")
    return name


def validate(name):
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
        raise ValueError("Indicar CHANGE con nombre kebab-case")
    directory = Path("openspec/changes") / name
    required = [directory / f"{artifact}.md" for artifact in ("proposal", "design", "tasks")]
    if not all(p.is_file() and p.read_text().strip() for p in required):
        raise ValueError("Faltan proposal.md, design.md o tasks.md no vacíos")
    if not list((directory / "specs").glob("*/spec.md")):
        raise ValueError("Falta al menos un delta de capability")
    subprocess.run(["openspec", "validate", name, "--strict", "--no-interactive"], check=True)


def main(args):
    if len(args) != 2 or args[0] not in {"validate", "commit"}:
        raise ValueError("Uso: openspec_guard.py validate CHANGE | commit MESSAGE_FILE")
    if args[0] == "validate":
        validate(args[1])
    else:
        # --no-renames exposes both deletion and addition, including cross-policy renames.
        paths = subprocess.check_output([
            "git", "diff", "--cached", "--name-only", "--no-renames", "-z"
        ]).decode().split("\0")
        if any(protected(p) for p in paths if p):
            validate(change_name(Path(args[1]).read_text()))


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except (ValueError, subprocess.CalledProcessError) as exc:
        print(f"OpenSpec gate: {exc}", file=sys.stderr)
        sys.exit(1)
