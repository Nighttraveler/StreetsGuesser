## ADDED Requirements

### Requirement: Range OpenSpec validation
The repository SHALL provide `make openspec-ci-validate BASE=<ref> HEAD=<ref>` as a read-only gate for the commits reachable from HEAD but not BASE. It SHALL compare each commit to its first parent (or the empty tree for a root commit), and read OpenSpec artifacts from the current worktree. To validate a candidate reproducibly, run from the root of a clean checkout of that candidate.

#### Scenario: Valid protected range
- **WHEN** BASE and HEAD resolve and every protected commit has one valid OpenSpec trailer with existing strict-valid artifacts
- **THEN** the target validates each distinct referenced change once and runs strict, non-interactive global OpenSpec validation

#### Scenario: Missing required arguments or invalid refs
- **WHEN** BASE or HEAD is missing or does not resolve to a commit
- **THEN** the target fails with a diagnostic and does not modify the worktree

#### Scenario: Protected commit without valid trailer
- **WHEN** a commit in the range changes a protected path and lacks exactly one `OpenSpec-Change: <kebab-case-name>` line in its Git trailer block
- **THEN** the target fails and identifies the offending commit

#### Scenario: Referenced OpenSpec artifacts missing or invalid
- **WHEN** a protected commit references a change missing a nonempty proposal, design or tasks file, a capability delta, or passing strict validation
- **THEN** the target fails without changing the worktree

#### Scenario: Rename or deletion in a protected range
- **WHEN** a protected file is renamed or deleted in the range
- **THEN** the target evaluates the affected paths and applies the same trailer and OpenSpec requirements

#### Scenario: No protected paths
- **WHEN** the range is empty or all changed paths have `.md` or `.txt` extensions or are under `openspec/`
- **THEN** the target does not require an implementation trailer but still runs strict, non-interactive global OpenSpec validation
