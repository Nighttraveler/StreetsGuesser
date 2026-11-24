## ADDED Requirements

### Requirement: Selección por identificador desde la portada

Cada entrada mostrada en la portada SHALL tener un botón nativo con el nombre exacto de la ciudad como texto, el ID estable del catálogo como `data-city-id`, foco visible y una altura de al menos 44 píxeles. Activar el botón SHALL seleccionar la ciudad por su ID en el panel clasificado, actualizar las dificultades y la clasificación cuando cambie el ID, y enfocar la dificultad si está habilitada o la ciudad de otro modo. La selección SHALL NOT iniciar sesión, iniciar o abandonar partidas, ni solicitar otro catálogo.

#### Scenario: Activar una ciudad con teclado o toque

- **WHEN** el visitante activa una ciudad en la lista de la portada
- **THEN** el selector clasificado conserva el ID de esa ciudad y ofrece las dificultades correspondientes
- **AND** el foco pasa a la dificultad, sin crear sesión ni partida

#### Scenario: Ciudades con el mismo nombre

- **WHEN** dos ciudades comparten nombre y se activa la segunda
- **THEN** se selecciona el segundo ID, no la primera coincidencia por nombre

#### Scenario: Ciudad sin dificultades

- **WHEN** se activa una ciudad que no tiene dificultades
- **THEN** el foco pasa al selector de ciudad y jugar clasificado permanece deshabilitado
