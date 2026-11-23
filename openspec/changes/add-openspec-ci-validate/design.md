## Context
El guard existente valida un nombre de cambio y el trailer de un commit individual, pero no recorre un rango entre una base y un HEAD. El nuevo target debe ser sólo de lectura y funcionar desde cualquier worktree del repositorio.

## Goals / Non-Goals
Proveer un gate local reproducible para el rango Git indicado y fallar ante argumentos ausentes, referencias inválidas, cambios protegidos sin trailer o OpenSpec inválido. No modificar commits, worktrees ni reemplazar la validación estricta global.

## Decisions
- `BASE` y `HEAD` son obligatorias y deben resolverse a commits. El script recorre `BASE..HEAD` con `git rev-list` sobre los SHA resueltos: analiza los commits alcanzables desde `HEAD` que no son alcanzables desde `BASE`.
- Compara la entrada de cada commit (`git diff-tree`) con su primer padre, o con el árbol vacío para un commit raíz. Deshabilita la detección de renombres para contar ambos lados y usa rutas delimitadas por NUL para conservar sus nombres. Como en el guard local, `.md`, `.txt` y `openspec/` están exentos.
- Cada commit con rutas protegidas debe tener exactamente un trailer en el pie, escrito `OpenSpec-Change: nombre-kebab-case`. Se rechazan ausencia, duplicados y valores inválidos.
- Reutiliza las comprobaciones de artefactos del guard local. Valida cada cambio referenciado una vez con `openspec validate <nombre> --strict --no-interactive`. Al final ejecuta `openspec validate --all --strict --no-interactive`, incluso si no encontró commits protegidos.
- Los commits y sus rutas se leen del rango; los artefactos de OpenSpec se leen del worktree actual. Para verificar un candidato reproducible, ejecutar desde la raíz de un worktree limpio en el `HEAD` del candidato. El gate no crea commits ni altera el worktree.

## Verification
Pruebas del script y del target mediante `python3 -m unittest discover -s tests -p test_openspec_ci_validate.py -v`, con Git y Make en repositorios temporales. Verificación del target con OpenSpec real en el rango del candidato y repetición después del commit para incluir su propio trailer. Validación estricta de OpenSpec, pruebas del guard, regresiones del juego y navegador, y `git diff --check`.
