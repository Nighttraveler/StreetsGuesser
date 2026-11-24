# Portada de ciudades — t_c787e9f6

## Contrato y alcance

Entrada real: `/` y `/index.html`. Se agrega la sección «Ciudades disponibles» antes del juego, sin cambiar las reglas ni el dataset de práctica. La fuente es el catálogo público global ya existente: `createRankedClient().catalog()` → `GET /api/v1/catalog` → `Catalog.view()`. Se comparten carga inicial, filtros y reintentos con rankings; se preservan nombres y orden y no se crean identidades ni partidas al visitar. No existen estudios/tenants en este proyecto; no se modifican permisos ni endpoints.

OpenSpec `city-home-landing`, validado y comprometido en `015d4276f0f9ce64658a31b2ef6af25998e48ed9` antes de editar rutas protegidas. Rama `wt/t_c787e9f6`, base común con main `e42ae8d74b3e32625d9ddb6307bbc87644cf8c90`. El SHA de implementación definitivo se registra en el handoff Kanban.

Estados: carga accesible y bloqueo de reintentos concurrentes; éxito; vacío confirmado; fallo HTTP/red/formato con reintento. Actualizar limpia lista y filtros anteriores e invalida respuestas de clasificación antiguas. Nombres mediante textContent, sin HTML interpretado. Lista semántica responsive, nombres largos completos sin truncar.

El servidor estático de cinco activos no ofrece catálogo ni módulos de rankings: muestra indisponibilidad (no vacío ni ciudad ficticia), mientras práctica sigue funcionando sin requests API. El reintento se deshabilita en ese caso porque falta el módulo, no por un fallo transitorio del servicio.

## Pruebas ejecutadas

Entorno: Node v22.22.3, OpenSpec 1.4.1; Playwright fijado por package-lock y Chromium `/usr/bin/chromium`. Instalación de tooling: `npm ci --ignore-scripts --no-audit --no-fund` correcta.

- RED previo: `node --test tests/city-catalog.test.mjs` falla por export validateCatalog inexistente. Tras implementación: 2/2 pasan; conserva nombres/orden/resultado vacío y rechaza estructuras inválidas.
- `npm test`: 33/33 pasan, incluidas las dos pruebas nuevas. Sin umbrales rebajados ni pruebas eliminadas.
- `npm run test:functional`: 12/12 Chromium pasan. Mantiene gestos, alias, progreso y niveles completos del juego.
- `node --experimental-sqlite --test tests/city-home-browser.test.mjs tests/rankings-client.test.mjs tests/rankings-browser.test.mjs tests/rankings-integration.test.mjs tests/static-practice-browser.test.mjs`: 16/16 pasan. Incluye 3 escenarios nuevos de portada, 4 de cliente, 7 de rankings UI, una integración real completa y una regresión del servidor estático real.
- `python3 -B -m unittest discover -s tests -p 'test_serve_static.py' -v`: 4/4 pasan; cinco activos/headers/HEAD/allowlist privados intactos.
- `make openspec-validate CHANGE=city-home-landing`: válido.
- `openspec validate --all --strict --no-interactive`: 11/11 cambios válidos.
- `make openspec-guard-test`: 7/7 pasan.
- `node --check app.mjs`, `node --check rankings-ui.mjs`, `node --check ranked-game-client.mjs` y `git diff --check`: sin errores.

La nueva suite usa createApplication real con SQLite y dos registros (Arrecifes y una segunda ciudad de prueba explícita usando el dataset existente) en almacenamiento temporal. Compara las filas contra el catálogo HTTP real y el selector, verifica una consulta por visita, cero POST y cero cookies en `/` y `/index.html`, a 375×812 y 1280×1000. Fixtures separadas ejercitan demora, vacío, HTTP 503, desconexión, formato inválido, recuperación por teclado, texto HTML hostil y nombres largos. La prueba estática usa serve_static.py real con los cinco activos del Dockerfile, responde una calle real, suma 10 y comprueba cero requests API.

Capturas reales inspeccionadas visualmente, fuera del repo:

- `/home/fer/.hermes/profiles/programador/cache/scratch/city-home-375.png`
- `/home/fer/.hermes/profiles/programador/cache/scratch/city-home-1280.png`

Móvil: lista en una columna y título multilínea legible; escritorio: dos columnas. Sin desborde, nombres completos, mismo tema oscuro/verde y foco visible del proyecto. Son capturas con un registro sintético de prueba claramente identificado, no datos inventados de producción.

## Fallos de preparación corregidos

La prueba de contrato anterior devolvía `{}` como catálogo: se corrigió su fixture a `{cities:[]}`, conservando sus aserciones de transporte. La suite de práctica tenía un servidor sin endpoint de catálogo: ahora devuelve un vacío explícito de test, mientras la suite estática real sigue comprobando que allí no se consulta API.

El runner mouse asumía coordenadas permanentes tras pulsar controles: con la portada antes del juego, el scroll anchoring dejaba el centro del SVG fuera del viewport (diagnóstico real: y = -54.5625 tras Vista general). Se encuadra el mapa antes de calcular coordenadas y se recalcula el clic final. Se mantuvieron tolerancias y todas las aserciones; prueba aislada 1/1 y suite completa posterior 12/12 verdes. No se alteró la lógica de cámara para corregir el runner.

## Límites y entrega

Sin migraciones, dependencias nuevas runtime, cambios GIS, backend ni Docker. No hay build frontend: se sirven módulos/HTML/CSS directamente. No se ejecutó build Docker porque no cambian imagen ni allowlist; se verificó el handler estático real. No probado en dispositivos físicos, Safari o Firefox. No se hizo despliegue, push, rebase ni integración a main.

Implementación lista para QA hija `t_66dd66e9`; esta fase no equivale a aprobación independiente ni cierre de la entrega integrada. QA y el integrador deben verificar el SHA exacto y main antes del cierre raíz.
