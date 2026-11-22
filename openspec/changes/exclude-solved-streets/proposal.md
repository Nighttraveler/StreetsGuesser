## Why
Las calles acertadas reaparecen y no existe progreso único por dificultad. t_25ef22af debe preparar el estado y la rotación para el contador y ascenso de t_89aabed0.

## What Changes
- Identidad estable de entidad GIS mediante sus osm_way_ids únicos ordenados, sin modificar datos ni depender de nombre, índice o referencia de objeto.
- Aciertos únicos por nivel dentro de la partida; errores, pistas y saltos no retiran calles.
- Consulta pura de acertadas, total y completado; selección devuelve null al agotar un nivel.
- Adaptación mínima del controlador para conservar progreso entre niveles y no seleccionar ni aceptar respuestas cuando el nivel está agotado.
- Pruebas unitarias y Chromium de agotamiento, errores, saltos, duplicados y separación de niveles.

## Capabilities
### New Capabilities
- `unique-street-progress`: progreso único y exclusión por dificultad.

## Impact
Afecta game.mjs, app.mjs, tests/game.test.mjs, tests/browser.test.mjs y APP_README.md. Sin API remota, dependencias nuevas, migraciones ni modificación GIS/Docker. Contador visible y oferta de ascenso son alcance posterior, no de esta tarjeta.
