## Why
El operador aclara en t_35543100 que 8 y 51 son ejemplos: las respuestas cortas deben funcionar para cualquier ruta numerada, incluida la 191 del dataset.

## What Changes
- Aceptar ruta N y ex ruta N para cualquier registro cuyo nombre canónico u original sea una ruta numerada completa.
- Reconocer Ex- o ex separado y los calificadores Nacional/Provincial, conservando los nombres canónicos y originales actuales.
- Comparar el número completo y rechazar subcadenas, cruces de números y calificadores incorrectos.
- Añadir regresión unitaria y funcional, sin modificar GIS ni interfaz ni puntuación.

## Capabilities
### New Capabilities
- `route-answer-aliases`: alias cortos generales y seguros para respuestas de rutas numeradas.

## Impact
game.mjs, tests/game.test.mjs, tests/browser.test.mjs y APP_SPEC.md. Sin dependencias, migraciones o despliegue.
