## Why
El estado de progreso ya existe en exclude-solved-streets, pero el jugador no ve acertadas/total ni puede aceptar una oferta de ascenso al completar.

## What Changes
- Mostrar el progreso de la dificultad activa, actualizado con cada acierto único.
- Ofrecer un botón explícito para la siguiente dificultad configurada sólo al completar; nunca avanzar automáticamente.
- Conservar progreso por nivel y mostrar completado sin avance inválido en la dificultad máxima.
- Añadir unitarias, regresiones Chromium y documentación. Sin cambios GIS, persistencia, Docker o despliegue.

## Capabilities
### New Capabilities
- `progress-and-level-advance`: contador visible y ascenso voluntario.

## Impact
index.html, app.mjs, game.mjs, tests/game.test.mjs, tests/browser.test.mjs y APP_README.md. Depende del candidato 2cee184. Sin API ni migraciones.
