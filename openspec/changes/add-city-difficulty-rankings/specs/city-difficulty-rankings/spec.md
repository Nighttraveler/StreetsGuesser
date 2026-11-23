## ADDED Requirements

### Requirement: Authoritative eligible games
The system SHALL accept only owned, completed server-authoritative games of the active board version, completed within 24 hours and submitted within 7 days, following RANKINGS_SPEC.md. Local practice SHALL remain separate.

#### Scenario: Forged points
- **WHEN** submission contains score, city_id, difficulty or player_id
- **THEN** the server returns 422 UNKNOWN_FIELD without reserving a name or result

#### Scenario: Foreign or unfinished game
- **WHEN** a player submits a foreign game or their own unfinished game
- **THEN** the server returns GAME_NOT_FOUND or GAME_NOT_ELIGIBLE respectively

#### Scenario: Completion
- **WHEN** every unique street is correctly answered through server actions
- **THEN** the server freezes the sum of 10 points per normal answer or 5 with a hint

### Requirement: Global username ownership
The system SHALL trim ASCII spaces, lowercase ASCII letters, validate usernames against [a-z0-9_]{3,20}, reject reserved names and enforce global uniqueness atomically. Each player SHALL have one immutable name.

#### Scenario: Reusing own name
- **WHEN** a player submits another eligible game with their canonical name
- **THEN** registration succeeds without conflicting with their existing ownership

#### Scenario: Concurrent equivalent names
- **WHEN** two players concurrently claim equivalent names
- **THEN** exactly one succeeds and the other receives USERNAME_TAKEN without partial writes

### Requirement: Independent ordered boards
The system SHALL expose one best result per player and active city/difficulty/version, ordered by score descending, completion time ascending and game UUID ascending, with ordinal positions.

#### Scenario: Lower or equal personal score
- **WHEN** a player submits a lower or equal score
- **THEN** the submission is recorded but the existing personal best remains

#### Scenario: Board filtering
- **WHEN** a public query selects city and difficulty
- **THEN** only entries of that active board version appear, with consistent count and pagination

### Requirement: Secure identity and idempotency
The system SHALL use opaque HttpOnly session cookies, same-origin mutation checks and API v1 contracts in RANKINGS_SPEC.md §8. Names SHALL NOT authenticate players. Mutations except session creation SHALL require per-player idempotency keys.

#### Scenario: Safe retry
- **WHEN** a successful mutation is repeated with the same key and body
- **THEN** its original response is returned without additional side effects

#### Scenario: Conflicting retry
- **WHEN** a key is reused with different request content
- **THEN** the server returns IDEMPOTENCY_CONFLICT

### Requirement: Explicit publication and independent UI
The system SHALL isolate ranking UI/service modules, offer explicit classified play and show success only after server confirmation.

#### Scenario: Unavailable name
- **WHEN** the server returns USERNAME_TAKEN
- **THEN** the UI explains the conflict and preserves the game for another name

#### Scenario: Timeout
- **WHEN** publication times out
- **THEN** the UI offers retry with the same key without synthesizing success

#### Scenario: Offline practice
- **WHEN** the API is unavailable
- **THEN** practice remains usable but cannot be published as an eligible result
