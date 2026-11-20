## ADDED Requirements

### Requirement: Validation before implementation
The project MUST provide make openspec-validate CHANGE=name and require proposal, design, tasks and capability deltas before protected edits.

#### Scenario: Missing planning artifact
- **WHEN** validation is requested for a change without tasks.md
- **THEN** validation fails before invoking implementation

### Requirement: Protected commit gate
The commit-msg hook MUST require exactly one valid OpenSpec-Change footer trailer on a protected commit and strictly validate its existing change. It MUST inspect old and new paths on rename and deletion. Documentation-only commits MAY omit the trailer.

#### Scenario: Duplicate trailer
- **WHEN** a protected commit has two OpenSpec-Change trailers
- **THEN** the hook rejects the commit

#### Scenario: Documentation only
- **WHEN** only Markdown documentation is staged
- **THEN** the hook accepts a message without trailer

### Requirement: Reproducible isolated delivery
The repository MUST provide hook tests and installation commands, preserve legacy static source hashes and prepare a separate Docker implementation worktree without merging it to main.

#### Scenario: Isolation
- **WHEN** the Docker implementation workspace is prepared
- **THEN** its branch differs from main and its baseline contains the validated governance gate
