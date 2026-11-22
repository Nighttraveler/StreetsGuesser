## ADDED Requirements

### Requirement: Stable per-difficulty identity
The game SHALL track solved streets per difficulty using a stable identifier derived from unique sorted OSM way IDs, not names, array indices or object references. Progress SHALL survive difficulty changes within the current in-memory game, while score and streak retain their existing reset behavior.

#### Scenario: Equivalent street objects
- **WHEN** a street is cloned or its OSM way IDs are reordered
- **THEN** it has the same identifier and cannot be counted twice

#### Scenario: Switch difficulties
- **WHEN** a player solves a street in easy, switches to medium and returns
- **THEN** easy retains its solved streets and medium has independent progress

### Requirement: Unique correct answers only
A correct answer SHALL add the current identifier once to its difficulty. Wrong answers, hints and skips SHALL NOT add progress or exclude the street. Repeated submission SHALL NOT add progress or score twice, including the same solved identifier after a round transition.

#### Scenario: Wrong and skip
- **WHEN** the player answers incorrectly or skips an unsolved street
- **THEN** progress is unchanged and the street remains eligible in later rounds

#### Scenario: Hint and correct
- **WHEN** the player requests a hint and then answers correctly
- **THEN** progress increases by one and the existing reduced score applies

### Requirement: Exhaustion and progress query
The rules SHALL expose correct, total and completed for a requested difficulty using unique entity identifiers. Selection SHALL exclude solved identifiers, avoid immediate repetition where alternatives remain, return null for an exhausted existing difficulty, and keep the existing error for a nonexistent difficulty. The controller SHALL prevent new playable rounds after exhaustion and SHALL NOT automatically change difficulty.

#### Scenario: Complete fifteen streets
- **WHEN** a player solves all fifteen distinct easy streets
- **THEN** progress moves from 0/15 to 15/15 once per unique success, completed becomes true and further selection returns null

#### Scenario: Last remaining street
- **WHEN** only one unsolved street remains, even if it was the previous skipped street
- **THEN** selection returns that street rather than a solved street

#### Scenario: Return to exhausted difficulty
- **WHEN** the player selects an already completed difficulty
- **THEN** no street is highlighted, answer controls are disabled and a completion message replaces the round prompt
