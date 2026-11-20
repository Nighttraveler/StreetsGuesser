# Reglas locales de Arrecifes de memoria

Este proyecto es independiente de Lawyers Hub. No usar su repositorio ni sus gates.

## Baseline y autorización

El usuario autorizó preparar Git, worktree y OpenSpec después del bloqueo de t_d76dc2c6. Esa autorización sustituye la prohibición histórica de inicializar Git en COMPOSE_SPEC.md:7; no altera el contrato técnico de Docker. El commit raíz importa fuentes heredadas: no afirma que tuvieran OpenSpec previo. Los cinco archivos publicables fueron comparados por SHA-256 contra /home/fer/projects/arrecifes-de-memoria-public sin modificarlos.

## Gate obligatorio

Requisitos: Git, Python 3, make, OpenSpec CLI 1.4.1; Node 22+ para regresión del juego. OpenSpec es tooling de desarrollo, no dependencia del runtime.

Antes de editar código, pruebas, scripts, configuración ejecutable o migraciones:

    openspec list
    openspec new change nombre-kebab-case
    openspec status --change nombre-kebab-case --json

Completar proposal.md, design.md, tasks.md y specs/<capability>/spec.md en openspec/changes/<nombre> y ejecutar:

    make openspec-validate CHANGE=nombre-kebab-case

COMPOSE_SPEC.md es la entrada arquitectónica para Docker; convertir su alcance en un cambio OpenSpec ANTES de implementar. No reconstruir una especificación retroactiva para código nuevo.

Antes de cada commit protegido:

    make openspec-validate CHANGE=nombre-kebab-case
    openspec validate --all --strict --no-interactive
    make openspec-guard-test
    npm test
    git diff --check
    make install-hooks

Añadir pruebas específicas, navegador y build Docker cuando corresponda. Preparar solo archivos propios, inspeccionar el diff staged completo, y usar exactamente un trailer:

    OpenSpec-Change: nombre-kebab-case

Protegido: cualquier archivo salvo .md/.txt y openspec/. Renombres y borrados cuentan por ambos nombres. El hook valida footer, artefactos existentes y OpenSpec estricto. El trailer no prueba que la especificación precedió al código ni sustituye revisión de alcance; QA revisa evidencia y commits. Hooks son locales y se reinstalan con make install-hooks en cada worktree. No usar --no-verify.

## Ramas y entrega

main conserva la importación inicial; setup/repository-governance contiene el gate pendiente de revisión, sin auto-merge. La implementación Docker usará programador/t_d76dc2c6 en .worktrees/t_d76dc2c6, basada en el commit del gate. Esto no equivale a modificar la asignación del tablero: al reactivar la tarjeta actualizar su workspace/rama a esos valores.

No implementar en main; no push, merge, rebase ni descarte de cambios. Entregar a QA hashes, merge-base, pruebas y worktree limpio. Mantener la infraestructura de gobierno y Docker como commits separados. QA debe revisar ambos si la infraestructura aún no fue integrada.

## Seguridad operativa

No tocar la unidad systemd ni /home/fer/projects/arrecifes-de-memoria-public durante preparación/implementación. La migración requiere smoke test y ventana explícita posterior. No versionar .env, node_modules, capturas generadas, backups ni secretos. No servir el repositorio completo. La lógica y GIS existentes están fuera del alcance Docker.
