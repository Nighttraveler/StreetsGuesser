import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
TRAILER = "OpenSpec-Change: local-change"


class CiGateTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.repo = Path(tmp.name)
        self.env = {key: value for key, value in os.environ.items()
                    if not key.startswith("GIT_") and key not in {"MAKEFLAGS", "MAKEOVERRIDES"}}
        self.env.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull, LC_ALL="C")
        self.git("init", "--quiet", "--initial-branch=fixture")
        self.git("config", "user.name", "OpenSpec CI Test")
        self.git("config", "user.email", "openspec-ci@example.invalid")
        self.write("README.md", "Base\n")
        self.base = self.commit("Initial documentation", "README.md")
        for path in ("Makefile", "scripts/openspec_ci_validate.py", "scripts/openspec_guard.py"):
            target = self.repo / path
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / path, target)
        self.change = "openspec/changes/local-change"
        for artifact in ("proposal.md", "design.md", "tasks.md", "specs/fixture/spec.md"):
            self.write(f"{self.change}/{artifact}", "Fixture artifact\n")
        self.write("bin/openspec", '#!/bin/sh\nprintf "%s\\n" "$*" >> "$VALIDATION_LOG"\n'
                                  '[ "$2" != "$FAIL_VALIDATION" ]\n')
        (self.repo / "bin/openspec").chmod(0o755)
        self.log = self.repo / "validation.log"
        self.env.update(PATH=f"{self.repo / 'bin'}{os.pathsep}{self.env['PATH']}",
                        VALIDATION_LOG=str(self.log), FAIL_VALIDATION="")

    def write(self, path, content):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def run_command(self, *args, check=True):
        return subprocess.run(args, cwd=self.repo, env=self.env, text=True, encoding="utf-8",
                              capture_output=True, check=check)

    def git(self, *args):
        return self.run_command("git", *args).stdout.strip()

    def commit(self, message, *paths):
        if paths:
            self.git("add", "--", *paths)
        self.git("commit", "--quiet", "-m", message)
        return self.git("rev-parse", "HEAD")

    def gate(self, base=None, head="HEAD"):
        return self.run_command(sys.executable, "scripts/openspec_ci_validate.py",
                                "--base", self.base if base is None else base, "--head", head,
                                check=False)

    def make_gate(self, base, head):
        return self.run_command("make", "openspec-ci-validate", f"BASE={base}", f"HEAD={head}",
                                f"PYTHON={sys.executable}", check=False)

    def assert_trailer_rejected(self, result, commit):
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(commit, result.stderr)
        self.assertIn("OpenSpec-Change", result.stderr)

    def test_make_validates_distinct_change_then_global_without_modifying_git_state(self):
        self.write("app.mjs", "first change\n")
        first = self.commit(f"Add app\n\n{TRAILER}", "app.mjs")
        self.write("app.mjs", "second change\n")
        head = self.commit(f"Update app\n\n{TRAILER}", "app.mjs")
        self.git("tag", "candidate", head)
        self.log.touch()
        before = self.git("status", "--porcelain=v1", "--untracked-files=all")
        result = self.make_gate(self.base, "candidate")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(first[:12], result.stdout)
        self.assertIn(head[:12], result.stdout)
        self.assertEqual(self.log.read_text().splitlines(), [
            "validate local-change --strict --no-interactive", "validate --all --strict --no-interactive",
        ])
        self.assertEqual(self.git("status", "--porcelain=v1", "--untracked-files=all"), before)
        self.assertEqual(self.git("rev-parse", "HEAD"), head)

    def test_make_rejects_missing_arguments(self):
        for base, head, missing in (("", "HEAD", "BASE"), (self.base, "", "HEAD")):
            with self.subTest(missing=missing):
                result = self.make_gate(base, head)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(f"{missing} is required", result.stderr)
        self.assertFalse(self.log.exists())

    def test_make_rejects_unknown_refs_and_non_commit_objects(self):
        tree = self.git("rev-parse", "HEAD^{tree}")
        for base, head, label in (("unknown-base", "HEAD", "BASE"),
                                  (self.base, "unknown-head", "HEAD"),
                                  (self.base, tree, "HEAD")):
            with self.subTest(base=base, head=head):
                result = self.make_gate(base, head)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(f"OpenSpec CI gate: {label} does not resolve to a commit", result.stderr)
        self.assertFalse(self.log.exists())

    def test_empty_range_still_runs_and_enforces_global_validation(self):
        self.env["FAIL_VALIDATION"] = "--all"
        result = self.gate()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.log.read_text(), "validate --all --strict --no-interactive\n")

    def test_documentation_and_openspec_paths_with_non_ascii_names_are_exempt(self):
        paths = ("guía\nlocal.md", "notes.txt", "openspec/config.yaml")
        for path in paths:
            self.write(path, "Documentation\n")
        self.commit("Update docs without trailer", *paths)
        result = self.gate()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.log.read_text(), "validate --all --strict --no-interactive\n")

    def test_invalid_trailers_are_rejected(self):
        messages = (
            "No trailer",
            f"Trailer in body\n\n{TRAILER}\n\nNot a footer",
            f"Duplicate trailers\n\n{TRAILER}\n{TRAILER}",
            f"Duplicate trailer key\n\n{TRAILER}\nopenspec-change: local-change",
            "Malformed trailer\n\nOpenSpec-Change: local_change",
        )
        for index, message in enumerate(messages):
            with self.subTest(message=message):
                base = self.git("rev-parse", "HEAD")
                self.write("app.mjs", f"revision {index}\n")
                sha = self.commit(message, "app.mjs")
                self.assert_trailer_rejected(self.gate(base), sha)
        self.assertFalse(self.log.exists())

    def test_rename_between_exempt_and_protected_paths_counts_both_sides(self):
        for source, target in (("README.md", "app.mjs"), ("app.mjs", "README.md")):
            with self.subTest(source=source):
                base = self.git("rev-parse", "HEAD")
                self.git("mv", source, target)
                sha = self.commit("Rename without trailer")
                self.assert_trailer_rejected(self.gate(base), sha)

    def test_deletion_of_a_protected_path_requires_trailer(self):
        self.write("app.mjs", "tracked file\n")
        base = self.commit(f"Add app\n\n{TRAILER}", "app.mjs")
        self.git("rm", "app.mjs")
        sha = self.commit("Delete without trailer")
        self.assert_trailer_rejected(self.gate(base), sha)

    def test_merge_changing_protected_path_from_first_parent_requires_trailer(self):
        self.git("switch", "-c", "side")
        self.write("app.mjs", "tracked file\n")
        self.commit(f"Add app on side\n\n{TRAILER}", "app.mjs")
        self.git("switch", "fixture")
        self.git("merge", "--no-ff", "-m", "Merge without trailer", "side")
        self.assert_trailer_rejected(self.gate(), self.git("rev-parse", "HEAD"))

    def test_missing_required_change_artifact_fails(self):
        (self.repo / self.change / "design.md").unlink()
        self.write("app.mjs", "tracked file\n")
        self.commit(f"Add app\n\n{TRAILER}", "app.mjs")
        result = self.gate()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("local-change", result.stderr)
        self.assertIn("design.md", result.stderr)
        self.assertFalse(self.log.exists())

    def test_failed_change_validation_propagates_failure(self):
        self.write("app.mjs", "tracked file\n")
        self.commit(f"Add app\n\n{TRAILER}", "app.mjs")
        self.env["FAIL_VALIDATION"] = "local-change"
        result = self.gate()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.log.read_text(), "validate local-change --strict --no-interactive\n")


if __name__ == "__main__":
    unittest.main()
