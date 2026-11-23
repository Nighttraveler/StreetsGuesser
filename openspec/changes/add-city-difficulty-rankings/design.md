## Context

Aplicación estática sin jugador/partida persistidos; evidencia en RANKINGS_SPEC.md §1. No aplica multitenancy de otros proyectos.

## Goals / Non-Goals

Goals: módulo independiente, nombres globales, elegibilidad verificable y contrato para UI/backend paralelos.
Non-goals: recuperación de cuentas, anti-cheat fuerte, importar práctica, despliegue o implementación en esta tarjeta.

## Decisions

Contrato normativo: RANKINGS_SPEC.md §§2–10. SQLite y un proceso Node, reutilización de game.mjs; identidad por cookie HttpOnly; username ASCII canónico global inmutable; puntos del servidor; mejor resultado por jugador/tablero/version. Orden score DESC/completed_at ASC/game_id ASC. Registro transaccional e idempotencia por key y game_id. Práctica separada del modo clasificado.

Alternativas, costes y reversibilidad en §3: PostgreSQL frente a SQLite, cuentas frente a identidad anónima, rechazo de score autodeclarado. Binding SQLite y empaquetado son validaciones pendientes de implementación.

## Risks / Trade-offs

Dataset público permite automatización; cookie perdida pierde identidad. SQLite limita escritores y offset no congela páginas entre requests. Producción exige TLS para sesiones aunque el estático actual admita HTTP. Runtime Node agrega coste operativo.

## Migration Plan

Incorporar contrato/OpenSpec antes de código. Backend implementa sesiones, partidas, migraciones y rankings; UI implementa modo clasificado y formulario. No migrar práctica anterior. Nueva versión activa tablero vacío conservando historia. Rollback deshabilita modo clasificado conservando DB; práctica permanece. QA e integración autorizada antes del cierre global, sin despliegue implícito.

## Open Questions

No decisiones bloqueantes delegadas: contratos y producto fijados. Recuperación, moderación y anti-cheat fuerte quedan fuera del MVP.
