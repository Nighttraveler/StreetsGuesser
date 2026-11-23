## 1. Diseño (t_82819d4f)

- [x] 1.1 Inspeccionar código real y ausencia de backend/identidades.
- [x] 1.2 Fijar producto, seguridad, datos y API en RANKINGS_SPEC.md.
- [x] 1.3 Definir ownership, ejemplos y matriz de aceptación.

## 2. Backend (t_1a20dae1; implementación para QA)

- [x] 2.1 Incorporar contrato previo, validar OpenSpec y binding SQLite/runtime.
- [x] 2.2 Crear identidad, catálogo, migraciones y partidas autoritativas con game.mjs.
- [x] 2.3 Implementar registro transaccional, UNIQUE, idempotencia, ranking y errores.
- [x] 2.4 Probar concurrencia, persistencia, seguridad, backup y harness mismo origen.
- [x] 2.5 Coordinar manifest/allowlist/empaquetado y entregar candidato exacto limpio.

Evidencia de la fase backend (`25d2fab6`): contrato previo commit `6e9b583`; Node 22.22.3/SQLite 3.51.3.
`npm test`: 31/31; suite backend con cobertura: 17/17, líneas 98.50%, ramas 88.89%.
Chromium heredado: 12/12 en repetición íntegra sin editar tests (primera corrida 11/12, foco/arrastre).
OpenSpec local PASS, global 8/8, guard 7/7, Python 22/22; diff-check PASS.
Ejecución, backup, pruebas y límites productivos en RANKINGS_BACKEND.md.
Empaquetado productivo/TLS no activado: harness Node por allowlist, Docker/Compose sin modificar.
SHA de la fase, base común y archivos exactos en el handoff Kanban; la revisión conjunta sigue pendiente en la sección 4.

## 3. Interfaz (t_0a5316a1; candidato para QA hija)

- [x] 3.1 Incorporar contrato y validar OpenSpec antes de código (commit previo 14e2c6e).
- [x] 3.2 Implementar cliente ranked-game y modo clasificado explícito sin importar práctica.
- [x] 3.3 Implementar formulario y consulta con estados y mocks contractuales.
- [x] 3.4 Probar navegador/red/sesión y entregar candidato limpio (ver RANKINGS_UI_TEST_RESULTS.md; API real conjunta corresponde a QA 4.1).

Evidencia de la fase de interfaz (`93af0826`): `RANKINGS_UI_TEST_RESULTS.md` conserva las pruebas del cliente, Chromium con API simulada y Chromium con API y SQLite reales del worktree backend. Esa última ejecución no sustituye la verificación de ambos commits combinados.

## 4. QA e integración (t_ad651c3c y raíz)

El candidato conserva un único commit de contrato previo (`4972096`), con los mismos archivos que `6e9b583` y `14e2c6e`, antes del commit que incorpora ambas implementaciones. Los estados y las evidencias de las secciones 2 y 3 corresponden a las entregas de cada fase, no a una aprobación conjunta.

- [ ] 4.1 Ejecutar matriz RANKINGS_SPEC.md §10 sobre backend/UI reales.
- [ ] 4.2 Verificar gates OpenSpec, regresión y Docker si cambia empaquetado.
- [ ] 4.3 Integración autorizada y verificación de main antes del cierre global; sin push/deploy implícito.
