## 1. Prior specification
- [x] Inspect matcher, dataset and operator clarification; publish file plan.
- [x] Validate and commit specification before protected edits (2eff84f).

## 2. Implementation
- [x] Add failing unit regression for generic short route aliases and exact-number rejection (12 pass, 2 expected fail before implementation).
- [x] Implement localized alias matching without changing normalization or GIS.
- [x] Add Chromium regression for all real routes and canonical feedback; update APP_SPEC.md.

## 3. Verification and handoff
- [x] Run unit and functional suites, OpenSpec validation, strict all validation, guard tests and diff checks (14 unit, 12 Chromium, 7 guard, 11 CI guard, 11 GIS via uv run test_gis.py).
- [x] Review staged changes, commit with valid trailer, verify clean worktree and prepare exact commits for child QA (implementation 6a1dd465b4e9d042defe127039fd0001c5dfb727; base f6bcda87be686856a11c504aef751d1c24662f58; range CI gate passed).

## Execution notes
The initial Chromium run found an incorrect expected feedback string in the new test, corrected to include the existing +10 puntos message. An existing unrelated map-click test also failed once (2 vs 3 clicks); unchanged on retry, the complete Chromium suite passed 12/12. Direct system Python lacked shapely; the declared script environment via uv run test_gis.py passed 11/11. No GIS changes, migrations, Docker rebuild, deployment or main integration. Child QA must review the generalized scope (including route 191), not just the original examples.
