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

## Corrección del hallazgo de QA — t_03f1f056

El candidato original `a4c0ce6` mostraba filas sin control ni identificador. El cambio OpenSpec `select-city-from-home` se validó antes de modificar código y pruebas. Ahora cada botón expone el ID del catálogo y selecciona esa ciudad en el panel clasificado. El foco pasa a dificultad (o a ciudad si no tiene dificultades). No inicia una sesión ni una partida, ni repite la consulta del catálogo.

| Caso | Resultado y evidencia |
| --- | --- |
| HOME-CITIES-01 | PASS: catálogo real SQLite de prueba con `arrecifes`, `fixture-city`, `san-nicolas`; los tres nombres aparecen una vez y los tres botones seleccionan su ID por Enter en escritorio. Se observan sólo solicitudes GET al mismo origen, una al catálogo, sin cookies ni excepciones. |
| HOME-CITIES-02 | PASS: `cities: []` muestra «No hay ciudades disponibles», cero filas y el inicio clasificado queda deshabilitado. |
| HOME-CITIES-03 | PASS: HTTP 503, fallo de red y respuesta malformada muestran «No se pudieron cargar las ciudades» sin filas previas; un reintento por teclado recupera los tres registros. |
| HOME-CITIES-04 | N/A para cambio de contexto: la portada no admite cambio de contexto. Se verifica estado «Cargando ciudades» e imposibilidad de duplicar una solicitud aún pendiente. |
| HOME-CITIES-05 | N/A: catálogo global, sin concepto de estudios ni permisos en este proyecto. |
| HOME-CITIES-06 | PASS: toque emulado selecciona cada ID a 375 px. Los tres botones tienen al menos 44 px de alto; la tabulación y el foco visible se verifican en escritorio. Nombres largos completos sin desborde y sin solapamientos visibles en las capturas de 375×812 y 1280×1000 (`test-results/city-home-*.png`, no versionadas). |

La suite también cubre dos ciudades de igual nombre con IDs distintos, conserva la dificultad al seleccionar la misma ciudad de nuevo y retira el estado de clasificación anterior cuando la ciudad elegida no tiene dificultades. Las ciudades de prueba se registran sólo en la base temporal de Chromium; no se añadieron ciudades a producción.

- `npm test`: 33/33.
- `npm run test:functional`: 12/12.
- Suite de portada, cliente, clasificación, integración SQLite y práctica estática con `node --experimental-sqlite --test tests/city-home-browser.test.mjs tests/rankings-client.test.mjs tests/rankings-browser.test.mjs tests/rankings-integration.test.mjs tests/static-practice-browser.test.mjs`: 18/18.
- Servidor estático Python: 4/4; pruebas del gate: 7/7; validación OpenSpec estricta: 12/12.

Pendiente: revisión independiente del candidato corregido e integración autorizada a `main`. No se hizo push ni despliegue.
