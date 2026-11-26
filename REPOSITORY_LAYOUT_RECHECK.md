# Revalidación de implementación — t_16c3de30

## Procedencia y alcance

Rama asignada: wt/t_16c3de30. Base común con main: eef9290713a13c229c2075130468adec7625fda9. Se recuperó la implementación existente de t_c591d950 sin reescribirla, mediante `git cherry-pick --ff`, preservando los hashes:

- f6104295d5eaa448a7706f34a4349287a9460407: OpenSpec previo.
- 0e9c75c20d6afbecfc20d762cb58960c90e20bdd: implementación, único trailer OpenSpec-Change: separate-frontend-backend.
- d4f6cb1bad7da1da607016c53d37685b0689c82e: evidencia histórica.

Se validó el cambio OpenSpec después de recuperar el primer commit y antes de recuperar protegidos. No se generó especificación retroactiva ni se duplicó implementación. Esta ejecución solo añade este informe y sincroniza tasks.md; el SHA candidato final queda en Kanban. El informe REPOSITORY_LAYOUT_VERIFICATION.md conserva los resultados y el bloqueo históricos, no describe el estado de la nueva fase.

Mapa aprobado t_1b760997: ocho archivos en frontend/; ranked-game/ completo, rankings/ y serve_static.py en backend/; data/ y herramientas GIS permanecen. Sin migración nueva: 001-rankings.sql solo se mueve. Las reglas frontend y el handler Python no cambian de bytes. Imports y rutas backend, Docker/package, extractor y suites acompañan el traslado. Ubicaciones y comandos de trabajo desde raíz: REPOSITORY_LAYOUT.md.

## Ejecución real en este worktree

Todos los comandos siguientes se ejecutaron desde la raíz de wt/t_16c3de30, sin cambios de código nuevos:

| Comando | Resultado |
| --- | --- |
| npm ci --ignore-scripts | PASS, dos paquetes, cero vulnerabilidades |
| npm test | PASS 39/39, cero skips; incluye dos regresiones layout |
| npm run test:functional | PASS 15/15, Chromium, touch/mouse/pinch y juego |
| node --experimental-sqlite --test --test-concurrency=1 tests/rankings-client.test.mjs tests/rankings-browser.test.mjs tests/city-home-browser.test.mjs tests/static-practice-browser.test.mjs tests/rankings-integration.test.mjs | PASS 20/20, cero skips, SQLite/HTTP/Chromium reales |
| RANKINGS_BACKEND_ROOT="$PWD/backend" node --experimental-sqlite --test tests/rankings-integration.test.mjs | PASS 1/1, cero skips |
| python3 -B -m unittest discover -s tests -p 'test_*.py' -v | PASS 22/22 |
| python3 -B -m unittest test_download_gis -v | PASS 11/11 |
| uv run --offline test_gis.py | PASS 16/16 |
| node --test --experimental-test-coverage tests/game.test.mjs | PASS 15/15; game.mjs 100% líneas, 98.33% ramas, 100% funciones |
| node --experimental-sqlite --test --experimental-test-coverage --test-coverage-include='backend/ranked-game/*.mjs' --test-coverage-include='backend/rankings/*.mjs' tests/sqlite-runtime.test.mjs tests/rankings.test.mjs | PASS 17/17; 99.00% líneas, 89.13% ramas, 98.80% funciones |
| node --check frontend/app.mjs; node --check frontend/game.mjs; node --check backend/ranked-game/server.mjs; bash -n tests/compose-smoke.sh | PASS |
| make openspec-validate CHANGE=separate-frontend-backend | PASS antes de recuperar código y después |
| openspec validate --all --strict --no-interactive | PASS 16/16 |
| make openspec-guard-test | PASS 7/7 |
| make openspec-ci-validate BASE=eef9290713a13c229c2075130468adec7625fda9 HEAD=HEAD | PASS, un commit protegido válido |
| make install-hooks; git diff --check | PASS |
| docker compose --env-file /dev/null config --quiet | PASS |
| git diff --exit-code eef9290 -- data/ compose.yaml package-lock.json download_gis.py Makefile scripts/ .githooks/ | PASS, sin cambios |

SHA-256 comprobados con sha256sum: frontend/arrecifes_calles.json y data/arrecifes/calles.json = ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e; SQL = 2c68d64918ddd216258ffae54a1f5c905da34b603e1e3ed27b7f21d5ce43d8b6.

## Límites y handoff

No se repitió build/smoke Docker: evidencia histórica 10/10 del mismo código en REPOSITORY_LAYOUT_VERIFICATION.md, no un resultado nuevo. La inspección actual confirma el contenedor streetguesser-smoke-tc591d950 (4c2add23e35f) Exited (255) y la imagen streetguesser:test-tc591d950, sha256:be5e0a905ef31bc120c0579ffb32bfd09bb27a5398b1e6119479f5068979ca94, todavía presentes. No se intentó de nuevo el lifecycle previamente rechazado ni se crearon recursos Docker. Falta limpieza humana autorizada y readback de ausencia. El ejecutor de Python arbitrario execute_code también fue denegado; se usaron terminales permitidas, no una evasión.

La limpieza pendiente queda informada en la raíz t_c591d950. La nueva fase implementadora puede entregar el candidato exacto para revisión de código a QA hija t_b81d0b89 sin afirmar limpieza, integración ni cierre final de la entrega raíz. QA debe considerar ese límite; no reutilizar los recursos Docker existentes ni certificar producción. No se ejecutó compose up ni el runner heredado que presupone una topología distinta de compose.yaml; no hay nuevo build frontend porque la aplicación no usa bundler. Sin prueba de dispositivos físicos ni Safari/iOS. Sin cambios de main, systemd, docroot externo, API, persistencia o mecanismo de despliegue. El único cierre de esta fase es la entrega del commit limpio a la QA hija; aprobación e integración siguen pendientes.
