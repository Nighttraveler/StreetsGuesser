## ADDED Requirements

### Requirement: Physical separation without duplicated domain logic
The repository SHALL place the eight browser assets in frontend/ and ranked-game/, rankings/ and serve_static.py in backend/. The backend SHALL consume the same frontend/game.mjs and public catalog as the browser. data/, GIS tools, tests/, scripts/, OpenSpec and root package/build configuration SHALL retain their locations.

#### Scenario: Development entry point
- **WHEN** npm run start:rankings runs from the repository root with its existing environment
- **THEN** the relocated Node server serves the same API and eight development assets from frontend/, with static serving disabled outside development

### Requirement: Unchanged datasets and persistence
The move SHALL preserve bytes of the public dataset, all data/ files and SQLite migration SQL, with no schema or state migration. GIS publication SHALL write only the regular frontend/arrecifes_calles.json copy identical to data/arrecifes/calles.json; staging acquisition SHALL NOT publish it.

#### Scenario: Integrity against baseline
- **WHEN** the relocated public JSON and migration are hashed
- **THEN** they match baseline ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e and 2c68d64918ddd216258ffae54a1f5c905da34b603e1e3ed27b7f21d5ce43d8b6 respectively

### Requirement: Preserved HTTP and deployment contracts
The application SHALL preserve /, /index.html, /play.html, root asset URLs and /api/v1 contracts. Docker SHALL copy exactly six practice assets from frontend/ and the backend Python launcher outside the docroot using explicit allowlists. Compose configuration, runtime restrictions and deployment mechanism SHALL remain unchanged.

#### Scenario: Practice without API
- **WHEN** Chromium opens the isolated Python image
- **THEN** home remains independent and practice works without rankings modules/API, while private paths, source data and unknown URLs return 404

### Requirement: Reproducible tooling and regression
Tests, scripts and active documentation SHALL use the new source locations while preserving HTTP expectations. The integration suite SHALL locate the local backend by default and retain RANKINGS_BACKEND_ROOT as a root containing ranked-game/. A missing local backend SHALL fail rather than silently skip.

#### Scenario: Full regression
- **WHEN** the baseline Node, browser, SQLite, Python, GIS and isolated image checks run after relocation
- **THEN** game behavior, rankings, API, dataset loading and asset publication match baseline and evidence identifies exact commands and candidate commits
