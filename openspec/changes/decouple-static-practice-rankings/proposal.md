## Why

El candidato 8dc5e789 importa rankings-ui.mjs estáticamente desde app.mjs. El servidor Python y la imagen solo publican cinco activos: el 404 aborta todo el módulo e impide jugar en práctica. La API y módulos de rankings son opcionales para práctica.

## What Changes

- Desacoplar la importación y montaje de rankings del arranque de práctica, capturando su indisponibilidad con un estado explícito sin alterar el juego local.
- Agregar regresión Chromium contra serve_static.py real con exactamente los cinco activos del Dockerfile, sin API ni módulos opcionales.
- Revalidar rankings con Node/API/SQLite del mismo candidato; documentar evidencia RED/GREEN y gates.
- No ampliar empaquetado, allowlist ni infraestructura; no modificar contratos API, GIS, migraciones ni el contrato previo add-city-difficulty-rankings.

## Capabilities

### New Capabilities
- `static-practice-independence`: práctica jugable sin módulos ni API opcionales.

### Modified Capabilities

Ninguna: se conserva el contrato previo de rankings, incluida práctica independiente.

## Impact

app.mjs, nueva prueba de navegador y documentación de evidencia. Dockerfile y serve_static.py permanecen intactos. Sin dependencias, migraciones ni despliegue.
