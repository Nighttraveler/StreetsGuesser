## ADDED Requirements

### Requirement: Home is independent of game runtime
The system SHALL serve / and /index.html as an independent home document with a Jugar link to ./play.html, without mounting game controls or initializing game, catalog or rankings modules.

#### Scenario: Visit home
- **WHEN** a visitor opens either home URL
- **THEN** no map or answer form is mounted and no game module, dataset or API request is made
- **AND** Jugar is keyboard accessible

### Requirement: Dedicated game document preserves behavior
The system SHALL serve the existing practice, city selection and ranked game interface at /play.html with working relative assets and an explicit home link.

#### Scenario: Direct entry and reload
- **WHEN** a visitor opens or reloads /play.html directly
- **THEN** the real practice dataset loads and answering, progress, camera and difficulties work as before
- **AND** ranked/catalog behavior remains available only when its modules and backend are served

#### Scenario: Navigate between home and game
- **WHEN** a visitor activates Jugar and then returns through the home link
- **THEN** the game loads only on the game document and the home has no active game runtime

### Requirement: Explicit public routing
Both the Python static server and Node development composition SHALL serve /play.html for GET and HEAD without a catch-all fallback. Docker SHALL publish only six approved assets including play.html, retaining existing isolation and security settings.

#### Scenario: HTTP contract
- **WHEN** clients request /play.html directly or with a query string
- **THEN** GET returns its HTML bytes and HEAD returns matching headers without body
- **AND** private files and unknown paths still return 404
