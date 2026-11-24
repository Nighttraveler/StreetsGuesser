## ADDED Requirements

### Requirement: Independent dashboard landing
The home document SHALL present the game with a compact, clearly headed dashboard grid and a primary native link named Jugar pointing to ./play.html. It SHALL NOT mount game controls, scripts, GIS data or API requests.

#### Scenario: Visit either home URL
- **WHEN** a visitor opens / or /index.html
- **THEN** they see the game's purpose and a Jugar link, with no game runtime or API/GIS requests

### Requirement: Honest useful content
The landing SHALL explain the highlighted street and name-guessing mechanic, difficulty selection, practice and conditional ranked mode without fabricated metrics or live states. Any decorative cartographic scheme SHALL be explicitly labelled illustrative, not a real map.

#### Scenario: Understand how to start
- **WHEN** a visitor reads the landing
- **THEN** ordered steps explain difficulty selection, recognizing a street and entering its name, and ranked availability is conditional on the server

### Requirement: Responsive keyboard access
The landing SHALL have semantic landmarks, clear heading hierarchy, visible keyboard focus and native navigable links. It SHALL remain legible without horizontal overflow at 320, 375, 768 and 1280 CSS pixels and with enlarged text.

#### Scenario: Navigate without a pointer
- **WHEN** a keyboard user tabs through the landing on mobile or desktop
- **THEN** links show visible focus and activating Jugar opens the dedicated game

#### Scenario: Small viewport or enlarged text
- **WHEN** the viewport is narrow or text size is doubled
- **THEN** panels reflow without clipping text or causing horizontal overflow

### Requirement: Preserve dedicated game behavior
The dedicated game SHALL continue to support direct entry, reload and navigation back to a home without active game runtime.

#### Scenario: Full document navigation
- **WHEN** the visitor enters via Jugar, reloads play.html and returns to home
- **THEN** the game works on its route and home contains no active game controls or runtime
