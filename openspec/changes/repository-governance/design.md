## Context
Este repositorio es independiente de Lawyers Hub. El commit raíz es una importación del juego existente, no una implementación nueva. No se toca el docroot publicado ni systemd.

## Decisions
- Todo archivo salvo documentación .md/.txt y openspec/ es protegido; renames y eliminaciones se inspeccionan por ambos nombres en el índice.
- El hook commit-msg exige exactamente un trailer OpenSpec-Change válido para commits protegidos, artefactos proposal/design/tasks y al menos un delta; ejecuta validación estricta.
- make openspec-validate CHANGE=nombre valida artefactos y OpenSpec antes de editar; la disciplina temporal se acredita en la ejecución, no se pretende probarla con un trailer.
- Bootstrap del gate cubierto por este cambio validado antes de escribir código. Los cambios futuros son en worktrees aislados, nunca main. No auto-merge ni push.
- Hook instalado en core.hooksPath mediante ruta absoluta al hook de este checkout; instalar en cada worktree con --worktree y extensions.worktreeConfig.
- Pruebas unitarias cubren ausencia/duplicados/trailer fuera de footer, identificador inválido, artefactos faltantes, documentos, renames y borrados.

## Risks
Hooks locales pueden omitirse fuera de este flujo; QA debe reproducir validación. OpenSpec no valida por sí solo que código y spec coincidan. No dependemos de infraestructura del otro proyecto.
