## ADDED Requirements

### Requirement: General short aliases for numbered routes
The answer matcher SHALL accept `ruta N` and `ex ruta N` for any full numbered route name matching an optional ex prefix, ruta, an optional Nacional or Provincial qualifier and a complete integer number N, in either the canonical name or original names. It SHALL apply existing case, diacritic and whitespace normalization and support ex separated by a space or hyphen.

#### Scenario: Real routes and additional numbers
- **WHEN** the active record is Ex-Ruta Nacional 8, Ruta Provincial 51, Ruta Provincial 191 or a numbered route with another number
- **THEN** ruta N and ex ruta N are accepted using that record's complete number

#### Scenario: Original route name
- **WHEN** a record has a full numbered route name among its original names
- **THEN** the short aliases for that original name are accepted

### Requirement: Exact numbers and preserved names
The matcher SHALL preserve existing canonical and original-name matching, the Merlassino alias, displayed canonical names, dataset and record identity. It SHALL reject partial numbers, cross-route answers, bare numbers, extra words and unrelated street names. Long qualified answers SHALL retain exact matching rather than discarding their qualifier.

#### Scenario: No numeric prefix matching
- **WHEN** ruta 80 is answered for route 8, ruta 510 for route 51, or ruta 8 for route 51
- **THEN** the answer is rejected

#### Scenario: Canonical reveal in browser
- **WHEN** a player submits a valid short route alias by Enter
- **THEN** the game awards the normal correct score and reveals the unchanged canonical name

#### Scenario: Existing names and unrelated streets
- **WHEN** the player submits an existing canonical or original name or uses the existing Merlassino alias
- **THEN** the existing matching behavior remains unchanged
- **AND** a non-route street does not acquire route aliases
