# Ubicaciones y trabajo local

Cambio estructural: `separate-frontend-backend`, tarea t_c591d950. Mapa aprobado t_1b760997; baseline QA t_f5a946ae: eef9290713a13c229c2075130468adec7625fda9. Los comandos se ejecutan desde la raíz del worktree, no desde frontend/ o backend/.

## Mapa

| Antes | Ahora | Responsabilidad |
| --- | --- | --- |
| index.html, play.html, styles.css | frontend/ con los mismos nombres | Portada independiente y vista del juego |
| app.mjs, game.mjs | frontend/ con los mismos nombres | Controlador y reglas puras compartidas |
| rankings-ui.mjs, ranked-game-client.mjs | frontend/ con los mismos nombres | UI y cliente de la API opcional |
| arrecifes_calles.json | frontend/arrecifes_calles.json | Copia pública regular generada |
| ranked-game/ y migrations/001-rankings.sql | backend/ranked-game/ y su migrations/ | API, partidas, identidad, catálogo y SQLite |
| rankings/ | backend/rankings/ | Nombres y rankings |
| serve_static.py | backend/serve_static.py | Servidor Python allowlist |

Conservan ubicación: data/, download_gis.py, extract_gis.py, pruebas GIS, tests/, scripts/, openspec/, package.json/lock, Makefile, Dockerfile y compose.yaml. No hay bundler, dist, workspaces npm ni dependencia nueva.

El backend importa el único frontend/game.mjs; no se duplican reglas. frontend/arrecifes_calles.json sigue siendo idéntico a data/arrecifes/calles.json. Solo el wrapper canónico offline del extractor publica esa copia. El downloader escribe en staging nuevo externo y no publica. data/arrecifes/city.json es configuración; source.json es raw; consultas y discover/verify son evidencia; calles.json, limite.geojson y metadata.json son derivados canónicos. Ninguno de esos archivos privados se publica como árbol data/. SQLite, WAL/SHM, snapshots y backups son estado runtime privado externo, no fuentes ni artefactos frontend.

## Arranque

Práctica sin API, puerto loopback libre:

    python3 -B -c 'from pathlib import Path; from backend.serve_static import StaticServer; StaticServer(("127.0.0.1", 18093), Path.cwd() / "frontend").serve_forever()'

Abrir http://127.0.0.1:18093/ y Jugar, o /play.html directamente. Ctrl+C termina. No ejecutar backend/serve_static.py directamente desde el repositorio: su entrypoint espera public/ adyacente, como en la imagen. No crear backend/public ni servir el checkout completo.

Clasificado (Node >=22.22, DB persistente privada fuera del docroot):

    RANKINGS_DEVELOPMENT=1 RANKINGS_DB=/ruta/privada/rankings/state.db npm run start:rankings

Mismo comando desde raíz; ejecuta backend/ranked-game/server.mjs, por defecto 127.0.0.1:8081. Sin modo desarrollo sigue siendo API-only con origen HTTPS y proxy confiable según RANKINGS_BACKEND.md. La imagen de enable-rankings-in-compose inicia el modo local desde ese mismo ejecutable. La guía del backend documenta el CLI de respaldo y su cobertura.

URLs intactas: /, /index.html, /play.html, activos en raíz HTTP y /api/v1/*. No hay prefijos /frontend o /backend públicos. Python publica seis basenames: index.html, play.html, styles.css, game.mjs, app.mjs, arrecifes_calles.json. Node de desarrollo añade los dos módulos opcionales de rankings. Publicar manualmente requiere copiar esos seis archivos explícitos desde frontend/ a un directorio dedicado nuevo, no frontend/ completo ni data/; no modificar el docroot externo activo.

## Regresión reproducible

    npm ci --ignore-scripts
    npm test
    npm run test:functional
    npm run test:rankings
    node --experimental-sqlite --test --test-concurrency=1 tests/rankings-client.test.mjs tests/rankings-browser.test.mjs tests/city-home-browser.test.mjs tests/static-practice-browser.test.mjs tests/rankings-integration.test.mjs
    RANKINGS_BACKEND_ROOT="$PWD/backend" node --experimental-sqlite --test tests/rankings-integration.test.mjs
    python3 -B -m unittest discover -s tests -p 'test_*.py' -v
    python3 -B -m unittest test_download_gis -v
    uv run --offline test_gis.py
    node --check frontend/app.mjs
    node --check frontend/game.mjs
    sha256sum frontend/arrecifes_calles.json data/arrecifes/calles.json backend/ranked-game/migrations/001-rankings.sql
    make openspec-validate CHANGE=separate-frontend-backend
    openspec validate --all --strict --no-interactive
    make openspec-guard-test
    git diff --check

La integración por defecto encuentra backend/ranked-game/http.mjs y falla si falta (sin skip). RANKINGS_BACKEND_ROOT conserva su contrato previo: directorio que contiene ranked-game/, no raíz del repositorio. También admite backends externos históricos con esa estructura. Capturas quedan en test-results/ de la raíz, ignoradas; no se distribuyen como activos.

## Docker sin despliegue

Dockerfile y .dockerignore permiten los ocho activos de frontend/ y los archivos de runtime Node requeridos, incluida la migración SQLite. Compose sirve la web y la API desde un puerto local del host Linux. El servidor Python independiente mantiene su allowlist para práctica estática. La guía de arranque, verificación y respaldo está en [DEPLOYMENT.md](DEPLOYMENT.md).
