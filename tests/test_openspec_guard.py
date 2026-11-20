import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / "scripts/openspec_guard.py"
spec = importlib.util.spec_from_file_location("guard", MODULE)
assert spec is not None and spec.loader is not None
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class GateTests(unittest.TestCase):
    def test_valid_trailer(self):
        self.assertEqual(guard.change_name("feat: example\n\nOpenSpec-Change: docker-deployment\n"), "docker-deployment")

    def test_invalid_messages(self):
        for message in ["feat: no trailer", "feat: x\n\nOpenSpec-Change: ../escape", "feat: x\n\nOpenSpec-Change: a\nOpenSpec-Change: b", "feat: x\n\nOpenSpec-Change: a\n\nnot a footer"]:
            with self.subTest(message=message), self.assertRaises(ValueError):
                guard.change_name(message)

    def test_policy(self):
        for path in ["README.md", "notes.txt", "openspec/changes/a/tasks.md"]:
            self.assertFalse(guard.protected(path))
        for path in ["Dockerfile", "compose.yaml", ".env.example", "scripts/gate.py", ".githooks/commit-msg", "app.mjs", "Makefile"]:
            self.assertTrue(guard.protected(path))

    def test_missing_artifacts(self):
        with self.assertRaises(ValueError):
            guard.validate("nonexistent-change-for-test")

    def test_invalid_name(self):
        with self.assertRaises(ValueError):
            guard.validate("../escape")

    def test_staged_policy(self):
        # Real Git index exercises deletion and rename across the documentation boundary.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def git(*args):
                subprocess.run(["git", "-C", directory, *args], check=True, capture_output=True)
            git("init", "-b", "test")
            (root / "app.mjs").write_text("old")
            git("add", "app.mjs")
            git("-c", "user.name=Test", "-c", "user.email=test@localhost", "commit", "-m", "initial")
            (root / "message").write_text("docs: no trailer")
            (root / "README.md").write_text("docs")
            git("add", "README.md")
            result = subprocess.run(["python3", str(MODULE), "commit", str(root / "message")], cwd=directory, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            git("mv", "app.mjs", "legacy.md")
            result = subprocess.run(["python3", str(MODULE), "commit", str(root / "message")], cwd=directory, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            git("rm", "-f", "legacy.md")
            result = subprocess.run(["python3", str(MODULE), "commit", str(root / "message")], cwd=directory, capture_output=True)
            self.assertNotEqual(result.returncode, 0)

    def test_strict_validation_is_invoked(self):
        with patch.object(guard.Path, "is_file", return_value=True), patch.object(guard.Path, "read_text", return_value="content"), patch.object(guard.Path, "glob", return_value=[Path("spec.md")]), patch.object(guard.subprocess, "run") as run:
            guard.validate("test-change")
            run.assert_called_once_with(["openspec", "validate", "test-change", "--strict", "--no-interactive"], check=True)


if __name__ == "__main__":
    unittest.main()
