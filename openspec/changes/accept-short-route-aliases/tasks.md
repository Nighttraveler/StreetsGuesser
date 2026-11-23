## 1. Prior specification
- [x] Inspect matcher, dataset and operator clarification; publish file plan.
- [x] Validate and commit specification before protected edits (2eff84f).

## 2. Implementation
- [x] Add failing unit regression for generic short route aliases and exact-number rejection (12 pass, 2 expected fail before implementation).
- [x] Implement localized alias matching without changing normalization or GIS.
- [x] Add Chromium regression for all real routes and canonical feedback; update APP_SPEC.md.

## 3. Verification and handoff
- [x] Run unit and functional suites, OpenSpec validation, strict all validation, guard tests and diff checks (14 unit, 12 Chromium, 7 guard, 11 CI guard, 11 GIS via uv run test_gis.py).
- [ ] Review staged changes, commit with valid trailer, verify clean worktree and hand off exact commits to child QA.
