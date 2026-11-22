## ADDED Requirements

### Requirement: Continuous primary mouse drag
The application SHALL pan a loaded map continuously in both axes while the primary mouse button is held after movement reaches 5 CSS pixels from the initial position. It SHALL translate screen movement into SVG units using the current screen transformation, preserve view dimensions and existing zoom limits, and cancel competing camera animation.

#### Scenario: Drag across a letterboxed zoomed map
- **WHEN** the player presses the primary button on the map and moves beyond the threshold
- **THEN** map content follows the pointer in both axes at the rendered scale without changing view width, height, active street or score

#### Scenario: Movement continues
- **WHEN** the player continues moving with the button held
- **THEN** the camera updates on each movement without waiting for release

### Requirement: Preserve clicks and controls
The application SHALL preserve clicks below the threshold, suppress the mouse click resulting from a drag, and SHALL NOT start dragging from interface controls or secondary buttons.

#### Scenario: Simple click and small movement
- **WHEN** the player clicks or moves less than 5 pixels before releasing
- **THEN** the camera does not pan and the ordinary click event remains available

#### Scenario: Drag release and next click
- **WHEN** the player releases after dragging and subsequently clicks normally
- **THEN** only the drag-associated click is suppressed and the subsequent click remains available

#### Scenario: Interface controls
- **WHEN** the player uses zoom, overview, locate, level or answer controls
- **THEN** their existing behavior remains functional without initiating a drag

### Requirement: Terminate safely
The application SHALL stop dragging on mouse release inside or outside the map, window blur, hidden document, camera command, or a subsequent movement without the primary button pressed.

#### Scenario: Release outside or lose focus
- **WHEN** a drag ends outside the map or focus is lost
- **THEN** movement after returning without a new primary press does not change the camera

#### Scenario: Camera command interrupts drag
- **WHEN** a zoom or round change is requested during a drag
- **THEN** the old gesture cannot overwrite the new camera command
