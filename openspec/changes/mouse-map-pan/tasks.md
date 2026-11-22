## 1. Preimplementation
- [x] Inspect camera, controls, deployment boundaries and existing tests.
- [x] Specify mouse-map-pan before protected edits.
- [x] Validate and commit specification before implementation (78fd2ad).

## 2. Implementation
- [x] Add unit tests for threshold and SVG delta conversion; demonstrate red then implement helpers.
- [x] Implement mouse gesture, click suppression, cleanup and cursor without new runtime files.
- [x] Add real Chromium coverage for drag, click, controls, interruption and animation.
- [x] Document usage and unchanged limits.

## 3. Verification and handoff
- [x] Run OpenSpec strict, guard tests, unit tests, functional tests and diff checks.
- [x] Inspect staged changes, install hooks, commit implementation and verify clean worktree (e90557f80270ac6dbb4fb4926c4fd7b723bed82b).
- [x] Prepare exact commits, base and evidence for existing QA child; release via implementation-phase completion, no merge or deployment.

## Evidence
Specification committed first in 78fd2ad. Implementation e90557f80270ac6dbb4fb4926c4fd7b723bed82b has exactly one OpenSpec trailer and was clean after commit. Branch wt/t_c065e516, merge-base 4c451ac03c0b10ebcc7ad6c0d62cce2ea328d280. Final documentation commit and candidate SHA are recorded in the Kanban handoff.

Unit tests 7/7 (initial missing-export red, then green); Chromium functional 8/8 twice consecutively; guard tests 7/7; static server tests 4/4; GIS 11/11; OpenSpec local and all strict valid; syntax checks and diff checks clean. Existing Compose smoke passed build arm64 and 9/9 HTTP/browser tests, lifecycle and offline rollback with verified isolated SMOKE_SUBNET=10.254.241.0/28 on loopback port 18092. Test project, network and tags removed. Dataset SHA-256 unchanged. Details, resolved setup failures and reproducible commands in APP_README.md.

QA t_548bb6b5 and integration remain pending; implementation-phase completion is not approval, main integration or production deployment. Blur/visibility tested by DOM simulation; Chromium mouse release outside tested with Playwright. Firefox/Safari and physical devices not tested.
