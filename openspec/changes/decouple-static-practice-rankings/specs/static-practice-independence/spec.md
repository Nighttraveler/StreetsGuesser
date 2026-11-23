## ADDED Requirements

### Requirement: Practice independent of optional rankings modules
The application SHALL load and allow local practice using only the five public assets of Dockerfile through the real serve_static.py server, without rankings modules or API. Optional rankings import or initialization failure SHALL be caught without preventing practice listeners, dataset loading or rendering.

#### Scenario: Static five-asset practice
- **WHEN** Chromium opens the real Python server publishing only index.html, styles.css, app.mjs, game.mjs and arrecifes_calles.json
- **THEN** the SVG map renders, the answer input becomes enabled and a correct practice answer updates score and progress without a rankings API

#### Scenario: Optional modules unavailable
- **WHEN** rankings-ui.mjs cannot be loaded
- **THEN** classified unavailability is displayed in its panel, its unavailable loading control is disabled and local practice remains playable without uncaught JavaScript exceptions

### Requirement: Preserve both server contracts
The correction SHALL NOT extend the static allowlist or Docker packaging and SHALL preserve working classified play on the Node server with its own SQLite API.

#### Scenario: Unknown and private paths
- **WHEN** the static server receives requests for rankings modules, API, private or unknown paths
- **THEN** it responds with 404 rather than publishing additional files or returning an index fallback

#### Scenario: Node rankings regression
- **WHEN** the full client, interface and Chromium integration suites run with the API and SQLite from the same candidate
- **THEN** classified games, explicit publication and ordered city/difficulty rankings continue to pass without skipped integration or an external backend
