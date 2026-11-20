## Why
El proyecto necesita una baseline Git revisable y un gate OpenSpec local antes de implementar Docker. El usuario autoriza inicializar Git y preparar una rama aislada; esto sustituye la restricción histórica de COMPOSE_SPEC.md:7.

## What Changes
- Registrar las fuentes existentes como importación inicial, sin fingir OpenSpec previo.
- Añadir gate local, hook commit-msg, pruebas y documentación de worktrees.
- Preparar rama aislada para t_d76dc2c6; no implementar ni migrar Docker aquí.

## Capabilities
### New Capabilities
- `change-governance`: validación previa y trailer único para commits protegidos.
### Modified Capabilities
Ninguna.

## Impact
Makefile, scripts de gate, hook versionado, pruebas y documentación. Sin cambios API, datos GIS ni runtime. Requiere Python 3, Git, make y OpenSpec 1.4.1. La baseline heredada no se especifica retroactivamente.
