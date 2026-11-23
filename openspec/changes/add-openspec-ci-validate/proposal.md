## Why
El contrato de QA requiere validar un rango Git completo con `make openspec-ci-validate`, pero el proyecto no ofrece ese target. Esto impide ejecutar de forma reproducible el gate antes de integrar cambios.

## What Changes
- Añadir el target local `openspec-ci-validate` al Makefile.
- Validar `BASE` y `HEAD`, trailers OpenSpec y diferencias del rango sin alterar el worktree.
- Ejecutar validación estricta de OpenSpec para los cambios protegidos del rango.
- Añadir pruebas del script y del target, y documentar su uso desde el worktree del candidato.

## Capabilities
### New Capabilities
- `openspec-ci-validation`: gate reproducible de validación OpenSpec sobre un rango Git.

## Impact
Makefile, scripts/openspec_ci_validate.py, tests/test_openspec_ci_validate.py y documentación OpenSpec. Sin cambios de runtime, GIS, Docker o despliegue.
