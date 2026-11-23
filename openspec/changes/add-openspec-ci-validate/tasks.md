## 1. Specification
- [x] 1.1 Check the existing planning artifacts and validate the updated contract before editing the gate.
- [x] 1.2 Confirm the target contract against local Makefile and existing OpenSpec guard.

## 2. Implementation and tests
- [x] 2.1 Implement range validation without mutating the worktree.
- [x] 2.2 Add Makefile target with required BASE and HEAD variables.
- [x] 2.3 Test the script and Make target with temporary Git repositories, including protected paths, trailers, renames, deletions, merges and invalid refs.
- [x] 2.4 Document invocation and failure behavior.

## 3. Pre-commit verification
- [x] 3.1 Run OpenSpec validation, guard and range tests, game unit and browser tests, and the diff check.
- [x] 3.2 Run `make openspec-ci-validate` against the candidate range before committing.

## Handoff
Commit with exactly one `OpenSpec-Change: add-openspec-ci-validate` trailer. Rerun the range gate after committing so it covers its own commit, and report the exact candidate SHA and verification results for independent QA.
