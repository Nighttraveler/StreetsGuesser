PYTHON ?= python3
.PHONY: openspec-validate openspec-guard-test install-hooks
openspec-validate:
	$(PYTHON) scripts/openspec_guard.py validate "$(CHANGE)"
openspec-guard-test:
	$(PYTHON) -m unittest discover -s tests -p 'test_openspec_guard.py' -v
install-hooks:
	git config extensions.worktreeConfig true
	git config --worktree core.hooksPath "$(CURDIR)/.githooks"
