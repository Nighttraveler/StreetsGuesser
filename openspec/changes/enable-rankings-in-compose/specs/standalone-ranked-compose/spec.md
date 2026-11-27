## ADDED Requirements

### Requirement: Standalone local ranked play

The default Compose deployment SHALL start the game and rankings API together on the Docker Linux host loopback address, with 8090 as the default HTTP port. It SHALL serve the existing public assets and rankings API from one origin without external infrastructure.

#### Scenario: Fresh local deployment

- **WHEN** Compose starts on a free port with a fresh volume
- **THEN** the practice game, classified game and public board are available in the browser at the configured loopback origin

#### Scenario: Local HTTP access control

- **WHEN** the API receives a request with a non-loopback peer or an unexpected Host, or a mutation with a different Origin
- **THEN** it rejects the request and keeps session and game state unchanged

#### Scenario: Private assets

- **WHEN** a browser requests source, database, configuration or other unlisted paths
- **THEN** the server returns 404 without directory listing or fallback

### Requirement: Persistent ranked state

Compose SHALL keep the SQLite database, WAL and private dataset snapshots in one local volume.

#### Scenario: Recreation and recovery

- **WHEN** the container is recreated with the same volume or a verified backup is restored to a separate volume
- **THEN** the existing session and the published mark remain available

### Requirement: Separate HTTPS configuration

The image SHALL support explicitly serving its frontend and API behind a separately managed HTTPS terminator using the existing exact origin and trusted proxy checks.

#### Scenario: HTTPS deployment

- **WHEN** the operator starts the image with that configuration
- **THEN** valid HTTPS requests from the configured proxy can use the API with the secure production cookie
