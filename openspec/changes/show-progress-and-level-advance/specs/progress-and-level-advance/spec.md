## ADDED Requirements

### Requirement: Active difficulty progress
The game SHALL visibly display correct/total for the active difficulty using getProgress, preserve independent progress across level changes and announce updates accessibly.

#### Scenario: Unique answers update the counter
- **WHEN** a player starts easy mode with 15 streets and answers each correctly
- **THEN** the counter advances from 0/15 through 15/15, once per unique correct street

#### Scenario: Non-correct actions
- **WHEN** a player answers incorrectly, requests a hint, skips or submits a resolved answer twice
- **THEN** those actions do not increase the correct counter

#### Scenario: Switching difficulty
- **WHEN** a player switches to a previously played difficulty
- **THEN** its own correct/total is shown, not the prior difficulty's counter

### Requirement: Explicit completion offer
The game SHALL offer the next configured difficulty only when the active difficulty is complete, without automatically switching or selecting another street.

#### Scenario: Completing easy mode
- **WHEN** the last easy street is answered correctly
- **THEN** 15/15 and completion remain visible, with an explicit button naming the next difficulty and no automatic advance

#### Scenario: Accepting the offer
- **WHEN** the player activates the next difficulty button
- **THEN** the next configured level becomes active, its own progress is displayed and existing score/streak reset rules apply

#### Scenario: Returning to a completed level
- **WHEN** the player manually returns to a completed difficulty
- **THEN** its full counter and valid next-level offer appear without selecting a street

#### Scenario: Highest configured difficulty
- **WHEN** the player completes the last configured difficulty
- **THEN** full progress and completion are visible and no next-level offer is shown
