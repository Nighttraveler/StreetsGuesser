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

1. **Implementación.** Trabajar en una rama y un worktree de la tarea, nunca directamente en `main`. El implementador no integra a `main` ni hace push, rebase o descarte de cambios. Entregar a QA el SHA exacto del candidato, la base común con `main`, los resultados de las pruebas y un worktree limpio. Mantener la infraestructura de gobierno y Docker como commits separados; si ambos están pendientes de integración, QA revisa ambos.
2. **Revisión e integración.** QA revisa en solo lectura el candidato exacto. Tras su aprobación, el integrador autorizado incorpora a `main` los cambios revisados. Preferir `git merge --ff-only` si `main` es ancestro del candidato; si la integración exige resolver conflictos, revisar y verificar el resultado antes de actualizar `main`. La integración local no autoriza un push ni un despliegue.
3. **Cierre.** No marcar una entrega de código como `Done` hasta comprobar que los cambios revisados están en `main` y que las pruebas aplicables pasan en la versión integrada. Registrar en la tarjeta el SHA revisado, el SHA final de `main` y las comprobaciones realizadas. Si falta integración o verificación, mantener la entrega en revisión o bloqueada e indicar qué falta.

## Seguridad operativa

No tocar la unidad systemd ni /home/fer/projects/arrecifes-de-memoria-public durante preparación/implementación. La migración requiere smoke test y ventana explícita posterior. No versionar .env, node_modules, capturas generadas, backups ni secretos. No servir el repositorio completo. La lógica y GIS existentes están fuera del alcance Docker.
