# Rankings UI — evidencia de implementación t_0a5316a1

## Trazabilidad

Rama: wt/t_0a5316a1. Base común inspeccionada con main: ead38d0654beeed77720ccc464169286da250c5a.
OpenSpec: add-city-difficulty-rankings. Contrato padre RANKINGS_SPEC.md incorporado sin cambios; gate previo PASS y commit documental 14e2c6e antes de editar código protegido. La entrega es una fase de implementación para QA hija t_ad651c3c; no integración, despliegue ni cierre global.

## Alcance

- ranked-game-client.mjs: HTTP mismo origen con credenciales cookie, errores tipados e Idempotency-Key estable ante transporte/429/503; nuevo intento al corregir formulario. Sin tokens ni puntuaciones locales en publicaciones.
- rankings-ui.mjs: catálogo, selección de ciudad/dificultad, sesiones, recuperación explícita al volver a elegir clasificado, acciones servidor, abandono confirmado, resultado final separado del juego siguiente y consentimiento público. Solo referencia game_id en localStorage, no credencial.
- app.mjs: práctica independiente; modo clasificado carga siempre el snapshot inmutable del servidor y muestra su progreso/puntos. game.mjs y datos GIS intactos.
- index.html/styles.css: formulario, avisos de identidad/nombre inmutable, clasificación actual con paginación, estados y regiones live; contenido remoto vía textContent.
- Tests nuevos cliente, Chromium con API contractual explícitamente simulada e integración Chromium con API/SQLite reales. Harness de regresión sirve los dos módulos adicionales.

## Ejecuciones reales

Runtime de esta ejecución: Node v22.22.3; Chromium /usr/bin/chromium; Playwright versionado existente.

- `npm test`: PASS, 14 pruebas del motor/práctica.
- `npm run test:functional`: PASS, 12 pruebas Chromium de regresión. La primera ejecución detectó 2 fallos de coordenadas porque el panel nuevo desplazaba el mapa fuera del viewport; se movió el panel debajo del juego y la suite completa volvió a verde sin debilitar pruebas.
- `node --test tests/rankings-client.test.mjs tests/rankings-browser.test.mjs`: PASS, 4 unitarias del adaptador y 7 Chromium contractuales. Incluye conflicto de nombre, consentimiento, doble submit, transporte y key estable, loading/empty/error, respuesta tardía de otra ciudad, XSS como texto, sesión perdida, recuperación, cambio de dificultad con confirmación y score cero, nombre bloqueado y versión retirada.
- `RANKINGS_BACKEND_ROOT=/home/fer/projects/StreetGuesser/.worktrees/t_1a20dae1 node --experimental-sqlite --test tests/rankings-integration.test.mjs`: PASS, 1 prueba, 0 skipped. Dos contextos Chromium y sesiones HttpOnly, API real del hermano mediante createApplication, SQLite y snapshots privados temporales. Completa 15/15 en cada contexto; 145 puntos con pista frente a 150 normales. Publica ` Ana_7 `, rechaza `ANA_7` del segundo owner, publica bea_9 y confirma orden 150/145 y dificultad 2 vacía. Ninguna respuesta API simulada en esta prueba. Se cierra API/navegador y se elimina únicamente el directorio temporal creado por el test.
- `make openspec-validate CHANGE=add-city-difficulty-rankings`: PASS.
- `openspec validate --all --strict --no-interactive`: PASS, 8 cambios.
- `make openspec-guard-test`: PASS, 7 pruebas.
- `git diff --check`: PASS.
- `make install-hooks`: ejecutado; hook versionado activo para este worktree.

## Reproducción conjunta / límites

El smoke real utilizó fuentes backend aún sin commit sobre su documento 6e9b583735119bc4181258ee8d420e9273a552c7; no constituye aprobación de un candidato backend exacto. QA debe repetirlo con los commits backend/UI combinados y completar su matriz de carreras, seguridad, persistencia y restauración. En una rama combinada se puede omitir RANKINGS_BACKEND_ROOT; si backend no existe, este test informa skip explícito, nunca una integración simulada.

No se modifica package.json/lock (ownership backend). Ejecutar los tests UI con los comandos explícitos anteriores; npm test conserva su alcance histórico. No hay build/transpilación TypeScript configurados: frontend nativo ESM. No se añaden dependencias.

Sin migraciones UI. Backend administra migraciones y harness de mismo origen con allowlist de ambos módulos. Docker/Compose/serve_static.py no se modifican aquí; activar estos activos en el empaquetado productivo y TLS/API requiere trabajo coordinado posterior, no copiar esta UI sobre un servidor con allowlist antigua. No se tocó systemd ni el directorio público externo.

Los mocks solo existen en tests. Ante API ausente la UI no inventa éxito y conserva práctica. La recuperación de sesión perdida no reclama partidas por nombre; se puede salir explícitamente a práctica e iniciar una identidad nueva. Consulta pública no inicializa sesión. El ranking no promete estabilidad entre páginas. La pérdida de cookie pierde identidad conforme al contrato.
