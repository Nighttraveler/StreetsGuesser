## Why

La interfaz, servicios y fuentes GIS comparten hoy la raíz. Separar sus ubicaciones hace explícitas sus responsabilidades sin alterar juego, rankings, API ni despliegue.

## What Changes

- Mover ocho activos a frontend/ y servicios/migración a backend/ según mapa aprobado en t_1b760997.
- Ajustar imports, fixtures, scripts, salida pública GIS, COPY/allowlist Docker y documentación operativa.
- Mantener data/, herramientas GIS, tooling, tests y configuración raíz; conservar bytes del dataset y SQL.
- Añadir regresiones de estructura y repetir baseline QA t_f5a946ae, incluyendo SQLite real, navegador y smoke Docker aislado.

## Capabilities

### New Capabilities

- `repository-layout`: separación física con contratos de ejecución y publicación preservados.

### Modified Capabilities

Ninguna: los contratos funcionales no cambian.

## Impact

Frontend, backend, pruebas, package.json, Dockerfile/.dockerignore, referencias GIS y documentación. Sin dependencias, bundler, paquetes compartidos, migración de estado ni despliegue. Base eef9290713a13c229c2075130468adec7625fda9; rama wt/t_c591d950. Compose y servicios activos no se modifican.
