# Verificación de reorganización — t_c591d950

Rama: wt/t_c591d950. Base común y baseline main: eef9290713a13c229c2075130468adec7625fda9. Especificación previa: separate-frontend-backend, commit f610429 (validado antes de tocar protegidos). Implementación: 0e9c75c20d6afbecfc20d762cb58960c90e20bdd, con exactamente un trailer OpenSpec-Change: separate-frontend-backend. Worktree limpio comprobado después del commit. El commit documental posterior sincroniza esta evidencia y checklist; hashes completos finales en Kanban. No implica integración ni aprobación QA.

## Resultados ejecutados

Entorno: Linux arm64; Node v22.22.3, npm 12.1.0, Python 3.13.5, Chromium 151.0.7922.173.

- `node --test tests/repository-layout.test.mjs` antes del traslado: RED, 0/2, por ausencia de frontend/ y COPY antiguo. Después: 2/2 verdes, incluidos en npm test.
- `npm ci`: PASS, dos paquetes instalados, cero vulnerabilidades.
- `npm test`: 39/39 PASS, 0 skips (baseline 37 + dos regresiones de layout).
- `npm run test:rankings`: 17/17 PASS, SQLite/HTTP reales, concurrencia, transacción, backup CLI, migraciones repetidas, SIGTERM/reinicio.
- `node --test tests/rankings-client.test.mjs`: 4/4 PASS.
- `npm run test:functional`: 15/15 PASS, mouse/touch/pinch, flujo principal completo, tres dificultades, errores y recuperación.
- `node --experimental-sqlite --test --test-concurrency=1 tests/rankings-browser.test.mjs tests/city-home-browser.test.mjs tests/static-practice-browser.test.mjs tests/rankings-integration.test.mjs`: 16/16 PASS, 0 skips. Incluye API SQLite + Chromium sin override, dos propietarios, partidas completas, conflicto canónico y orden del ranking.
- `RANKINGS_BACKEND_ROOT="$PWD/backend" node --experimental-sqlite --test tests/rankings-integration.test.mjs`: 1/1 PASS, 0 skips; mantiene raíz que contiene ranked-game/.
- `node --test tests/static-practice-browser.test.mjs`: 1/1 PASS repetida después de agregar 404 de prefijos frontend/backend y raw; Python real, seis activos, sin API/módulos opcionales.
- `python3 -B -m unittest discover -s tests -p 'test_*.py' -v`: 22/22 PASS (CI 11, guard 7, HTTP 4). HTTP 4/4 repetida tras agregar rutas privadas nuevas.
- `python3 -B -m unittest test_download_gis -v`: 11/11 PASS, sin red.
- `uv run --offline test_gis.py`: 16/16 PASS; transformación en temporales, sin regenerar canónicos por la mudanza.
- `node --test --experimental-test-coverage tests/game.test.mjs`: 15/15 PASS, frontend/game.mjs 100% líneas, 98.33% ramas, 100% funciones.
- `node --experimental-sqlite --test --experimental-test-coverage --test-coverage-include='backend/ranked-game/*.mjs' --test-coverage-include='backend/rankings/*.mjs' tests/sqlite-runtime.test.mjs tests/rankings.test.mjs`: 17/17 PASS, 98.50% líneas, 88.89% ramas, 98.80% funciones (igual a cobertura previa documentada; incluye procesos hijos).
- `node --check frontend/app.mjs`, `node --check frontend/game.mjs`, `node --check backend/ranked-game/server.mjs`, `bash -n tests/compose-smoke.sh`: PASS.
- `make openspec-validate CHANGE=separate-frontend-backend`: PASS antes del código y al validar implementación.
- `openspec validate --all --strict --no-interactive`: 16/16 PASS.
- `make openspec-guard-test`: 7/7 PASS.
- `git diff --check` y staged check: PASS. Hook instalado con make install-hooks y ejecutado sin bypass. `make openspec-ci-validate BASE=eef9290713a13c229c2075130468adec7625fda9 HEAD=HEAD` sobre 0e9c75c: PASS, un cambio protegido válido y 16/16 globales, incluidos renombres por ambos lados.

## Integridad

SHA-256 frontend/arrecifes_calles.json y data/arrecifes/calles.json: ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e.
SQL backend/ranked-game/migrations/001-rankings.sql: 2c68d64918ddd216258ffae54a1f5c905da34b603e1e3ed27b7f21d5ce43d8b6.
`git hash-object` de los ocho frontend, Python y SQL coincide con los blobs de `git ls-tree` del baseline. `git diff --exit-code <baseline> -- data/ compose.yaml package-lock.json download_gis.py Makefile scripts/ .githooks/`: exit 0. No cambian reglas, API, estado, migración, datos ni topología; backend solo modifica dos imports puros y dos rutas de composición.

## Imagen y límite operativo

`docker compose --env-file /dev/null config --quiet`: PASS. No se ejecutó Compose up ni el runner heredado que exige bridge/loopback distintos del Compose actual (problema preexistente documentado por QA baseline).

`docker build --label io.arrecifes.task=t_c591d950 -t streetguesser:test-tc591d950 .`: PASS; imagen sha256:be5e0a905ef31bc120c0579ffb32bfd09bb27a5398b1e6119479f5068979ca94, linux/arm64, contexto 160.40 kB. Contenedor propio streetguesser-smoke-tc591d950, ID 4c2add23e35fe460e826dc0e5672626acbe9399b795de8436fcbea2aebf19c04, etiqueta io.arrecifes.task=t_c591d950, publicado solo en 127.0.0.1:18096. Comando reproducible en REPOSITORY_LAYOUT.md.

Readback: healthy; usuario arrecifes UID 100/GID 101, rootfs read-only, cap-drop ALL, no-new-privileges:true, puerto loopback exclusivo; docroot contiene exactamente los seis basenames esperados. `COMPOSE_SMOKE_ORIGIN=http://127.0.0.1:18096 node --test tests/compose.test.mjs`: 10/10 PASS contra imagen real: bytes/MIME, JSON hash, HEAD, privados 404, portada, juego, respuesta y sin red externa.

Pendiente operativo: la política headless rechazó `docker stop streetguesser-smoke-tc591d950` antes de ejecutar la limpieza. En la reanudación, `docker ps -a --filter name=streetguesser-smoke-tc591d950` confirma que el contenedor propio existe con estado Exited (255); `docker image inspect streetguesser:test-tc591d950` confirma la misma imagen. Se necesita limpieza humana autorizada de ese contenedor detenido y de su imagen. No se reintentó ni eludió la operación rechazada. Una comprobación combinada Docker/exec y un probe Python inline también fueron bloqueados por el analizador en la ejecución previa; la verificación se obtuvo con comandos simples de solo lectura, Git y suites reales, no con resultados sintéticos.

Reanudación: se repitieron `make openspec-validate CHANGE=separate-frontend-backend`, validación global estricta (16/16), guard (7/7), `npm test` (39/39, cero skips), `git diff --check`, instalación de hooks y gate CI baseline..0e9c75c: todos PASS. Las suites de navegador, GIS y Docker anteriores no se presentan como reejecutadas en esta reanudación. Los dos archivos documentales pendientes pertenecen a esta tarjeta y se conservan en un commit documental separado.

No se certifican despliegue productivo, topología Compose, rollback operativo, Safari/iOS ni dispositivos físicos. Sin systemd, docroot externo, main, push o release modificados. Hasta resolver la limpieza operativa, esta fase queda bloqueada y QA hija no se libera; el código se conserva comprometido y limpio para reanudación.
