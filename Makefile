PYTHON ?= python3
.PHONY: openspec-validate openspec-guard-test openspec-ci-validate install-hooks
openspec-validate:
	$(PYTHON) scripts/openspec_guard.py validate "$(CHANGE)"
openspec-guard-test:
	$(PYTHON) -m unittest discover -s tests -p 'test_openspec_guard.py' -v
export BASE HEAD
openspec-ci-validate:
	@test -n "$$BASE" || (echo "BASE is required" >&2; exit 2)
	@test -n "$$HEAD" || (echo "HEAD is required" >&2; exit 2)
	$(PYTHON) scripts/openspec_ci_validate.py --base="$$BASE" --head="$$HEAD"
install-hooks:
	git config extensions.worktreeConfig true
	git config --worktree core.hooksPath "$(CURDIR)/.githooks"
