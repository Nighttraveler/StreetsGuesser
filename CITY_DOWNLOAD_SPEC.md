# Descarga GIS por ciudad: contrato de implementación

Estado: decisión arquitectónica para t_480ed6ad; implementación pendiente en t_84499d2c y QA en t_aafa5409. Base inspeccionada: ead38d0. Este documento no afirma que el módulo ya exista ni autoriza despliegue, push o integración sin QA.

## 1. Flujo real y límites del cambio

- La adquisición NO está en JavaScript ni en el extractor: son tres POST curl secuenciales documentados en GIS_README.md:93-101. Descubrimiento, verificación administrativa y extracción tienen respuestas independientes. No existe hoy una API Python de descarga ni errores tipados que preservar.
- discover.overpassql:1-4 busca el nombre en la provincia; verify-area.overpassql:1-4 verifica el punto; extract.overpassql:1-5 obtiene la relación y las vías con highway y name mediante map_to_area, con `out meta geom` sin bbox.
- extract_gis.py:23-36 reconstruye el límite y valida el punto; :58-101 transforma offline, recorta y agrupa; :108-132 lee/escribe archivos y genera procedencia. Relación, punto, nombres de archivos y endpoint están fijos en ese script.
- app.mjs:246-256 descarga únicamente el JSON estático público. No debe consultar Overpass ni conocer credenciales, ciudad seleccionada o fuentes raw. Su URL y errores se conservan.
- Dockerfile:5 y .dockerignore:1-9 publican una lista cerrada; serve_static.py:8-14 permite solo cinco activos. No ampliar el servidor al árbol data/.

Alcance: adquisición parametrizable de una localidad cuya relación OSM fue previamente identificada, separación de archivos por ciudad y adaptación mínima de rutas/identidad en la transformación. No cambiar algoritmos GIS, clasificación, niveles, respuestas del juego, UI, topología admitida ni proveedor. No implementar buscador mundial, selección automática de límites, caché, servidor de descarga ni soporte genérico para cualquier topología OSM.

## 2. Alternativas y decisión

A. Módulo Python de adquisición + configuración JSON declarativa + transporte curl (elegida).

- Pros: reutiliza Python existente, conserva POST y límites de conexión/tiempo de curl; sin librerías nuevas de runtime; pruebas sin red mediante transporte inyectado. GIS y adquisición siguen separados.
- Contras: requiere ejecutable curl para nuevas adquisiciones; hay que envolver sus errores. Transformación sigue requiriendo Shapely.
- Costo: bajo/medio de desarrollo (módulo, CLI y tests); operación manual igual a la actual, sin infraestructura adicional.
- Reversibilidad: alta; el transporte es sustituible sin cambiar configuración, datos públicos ni transformación.

B. Cliente HTTP Python puro (urllib o biblioteca adicional).

- Pros: una sola plataforma, sin proceso curl.
- Contras: urllib no reproduce directamente la distinción connect-timeout 15 y max-time 150; otra biblioteca agrega dependencia y aun exige definir deadline global.
- Costo: medio de implementación y verificación; cero infraestructura, más mantenimiento si se agrega librería.
- Reversibilidad: alta detrás del mismo contrato de transporte. No hace falta en este MVP.

C. Un script/consulta copiados por ciudad.

- Pros: cambio inicial mínimo.
- Contras: deriva de filtros, errores y política de red; incumple reutilización.
- Costo: bajo inicial, alto por cada ciudad; reversibilidad media por duplicados históricos. Descartada.

Decisión: A. Configuración por ciudad, no plugins ejecutables ni consultas arbitrarias aportadas por el usuario. Una sola plantilla final Overpass para todas las ciudades compatibles.

## 3. Archivos y propiedad

Crear `download_gis.py` (biblioteca importable y CLI) y `data/<slug>/city.json`. En cada directorio de ciudad conservar los nombres locales uniformes: city.json, extract.overpassql, source.json, calles.json, limite.geojson y metadata.json. Evidencia histórica de descubrimiento/verificación: discover.overpassql, discover.json, discover-retry.json, verify-area.overpassql y verify-area.json. Para Arrecifes usar `data/arrecifes/`.

- Los archivos raw, derivados GIS, queries y configuración canónicos pertenecen a data/arrecifes/. Mover sin reserializar los snapshots existentes.
- Excepción explícita de compatibilidad: mantener `frontend/arrecifes_calles.json` como copia pública generada de data/arrecifes/calles.json, con igualdad de bytes comprobada en pruebas (ubicación actualizada por separate-frontend-backend; URL HTTP raíz intacta). No es una segunda fuente editable. El CLI de descarga nunca modifica esa copia.
- No usar symlinks: la lista permitida Docker y los servidores de pruebas esperan el archivo regular de frontend/ publicado en la raíz HTTP. No introducir data/ en el docroot.
- No mover informes históricos GIS_TEST_RESULTS.txt, GIS_HANDOFF.json o GIS_BLOCKER.txt como si fueran vigentes. Actualizar GIS_README.md para distinguir rutas actuales y evidencia histórica; no reescribir resultados antiguos.
- Prohibido publicar source.json: contiene metadatos de editores OSM. Pruebas HTTP deben confirmar 404 para /data/arrecifes/source.json y /data/arrecifes/city.json.

## 4. Configuración mínima y validación

`city.json` es UTF-8 JSON, objeto con exactamente estos campos obligatorios:

| Campo | Tipo y regla | Arrecifes |
|---|---|---|
| schema_version | entero, exactamente 1 | 1 |
| slug | string ASCII kebab-case: `[a-z0-9]+(?:-[a-z0-9]+)*` | arrecifes |
| name | string no vacío para documentación | Arrecifes |
| boundary_relation_id | entero positivo, no booleano | 3743598 |
| reference_point_lonlat | array de dos números finitos, lon entre -180 y 180, lat entre -90 y 90 | [-60.1087380, -34.0674983] |

Rechazar claves desconocidas, versiones distintas, duplicados de claves y valores inválidos antes de cualquier IO de red. El directorio debe ser data/<slug>/ y coincidir con slug; el identificador no es un path libre. El nombre no se interpola en Overpass. No pedir area_id: se usa map_to_area de la relación. Provincia, nodo OSM y Wikidata son evidencia del descubrimiento, no entradas necesarias para la extracción final.

Endpoint y política HTTP pertenecen a `DownloadOptions`, no a cada ciudad: endpoint por defecto `https://overpass-api.de/api/interpreter`, User-Agent por defecto exactamente `ArrecifesStreetStudy/1.0 (one-off GIS extraction)` para compatibilidad operativa, connect_timeout_seconds=15, total_timeout_seconds=150, query_timeout_seconds=120. Permitir sobrescritura explícita por el operador/llamador, nunca por la respuesta remota; endpoint HTTPS con host y sin credenciales ni fragmento, timeouts positivos. El User-Agent histórico es identidad del cliente, no selector de ciudad; centralizarlo y no replicarlo en configs. Una futura actualización del agente no exige tocar ciudades.

## 5. Interfaz de biblioteca (nombres acordados, todavía no implementados)

Tipos Python dataclass sin dependencia externa: CityConfig, DownloadOptions, OverpassRequest, DownloadResult. Las funciones no dependen del cwd ni de variables globales de la ciudad actual.

- `load_city_config(path: Path) -> CityConfig`: parseo/validación local, sin red.
- `build_extract_query(city: CityConfig, options: DownloadOptions) -> str`: función pura, devuelve UTF-8 lógico con newline final. Para Arrecifes/defaults debe coincidir byte a byte con extract.overpassql actual: timeout 120, rel(3743598) dos veces, map_to_area->.urban, way["highway"]["name"](area.urban), out meta geom. Sin filtrado temprano de clases, bbox ni normalización de nombres.
- `download_city(city: CityConfig, *, options: DownloadOptions | None = None, transport=None) -> DownloadResult`: construye petición, invoca transporte una sola vez y valida respuesta. No escribe archivos, imprime ni publica datos; no hace descubrimiento/verificación ni transformación GIS implícitos.
- `transport(request: OverpassRequest) -> bytes`: inyectable; default curl. Request contiene endpoint, query, user_agent, connect_timeout_seconds y total_timeout_seconds. POST application/x-www-form-urlencoded con campo `data` codificado; nunca query concatenada a URL. Ejecutar curl como lista de argumentos, sin shell; flags equivalentes a -sS --fail --connect-timeout 15 --max-time 150 -A ... --data-urlencode data@- ENDPOINT, consulta por stdin y bytes por stdout. Sin redirects ni reintentos automáticos. No escribir respuesta directamente sobre source.json.
- `DownloadResult`: `city_slug: str`, `query: str`, `endpoint: str`, `raw_bytes: bytes`, `source: dict`, `source_sha256: str`. Hash sobre los bytes originales, no JSON reserializado. source mantiene elementos y osm3s originales, sin reclasificar, recortar o eliminar tags. Resultado completo o excepción; nunca `None`, array vacío sustituto ni éxito parcial.

Validación de respuesta: UTF-8/JSON válido (rechazar NaN/Infinity), objeto, elements array no vacío de objetos, osm3s objeto, remark no vacío rechazado, relación solicitada presente exactamente una vez con members no vacío y al menos un way con tags y geometry. Validar la estructura necesaria sin descartar campos desconocidos de Overpass. La geometría/topología detallada se valida exclusivamente en la transformación; no afirmar que HTTP 200 significa dataset publicable. Una localidad sin vías no genera éxito vacío.

Errores: excepción pública `DownloadError(code, message, *, city_slug=None, http_status=None, retry_after_seconds=None)`; códigos estables `config`, `transport`, `timeout`, `http`, `invalid_json`, `invalid_response`, `overpass_remark`, `io`. El transporte default traduce salida curl 28 a timeout, 22 a http y demás fallos a transport (incluye ejecutable ausente). Capturar status HTTP cuando esté disponible sin mezclarlo con raw_bytes; si no se conoce, usar None, nunca inventarlo. Un timeout parcial no retorna bytes exitosos. CLI convierte errores locales de escritura a io. Los tests inyectan los mismos errores tipados.

HTTP 406/429 y remark fallan sin reintentar. Si se dispone de Retry-After válido, exponerlo como consejo; indicar esperar al menos 30 segundos y revisar política vigente para 406/429, nunca dormir/repetir en bucle. No volcar payloads completos ni metadatos de editores a logs. Mensajes humanos pueden mejorar; la compatibilidad exigida es fallo visible/no publicación, no códigos de salida exactos del curl antiguo.

## 6. CLI y persistencia

Interfaz nueva: `python3 download_gis.py --city arrecifes --output-dir <directorio-nuevo>`; opciones de red explícitas opcionales con los mismos nombres kebab-case que DownloadOptions. Resolver config respecto del repositorio/módulo, no cwd. --city obligatorio: ninguna ciudad implícita dentro de la biblioteca.

Destino obligatorio: directorio nuevo de staging, externo a los datos canónicos. Si ya existe, fallar sin modificarlo. Descargar y validar antes de crearlo; escribir extract.overpassql y source.json exactos, reportar slug, destino y hash, exit 0. Fallo: mensaje conciso a stderr, exit no cero, sin modificar snapshot previo ni archivo público; limpiar únicamente el directorio creado por esa invocación ante fallo de escritura. No aceptar sobrescritura silenciosa, no implementar --force. El operador inspecciona y transforma el staging antes de promover un snapshot; la promoción no es parte de este CLI.

Descubrimiento y verificación siguen siendo un paso manual de alta de ciudad, documentado y conservado como evidencia. No ejecutar automáticamente las tres peticiones cada vez ni reemplazar la selección urbana revisada por búsqueda de nombre ambiguo. Conservar la política secuencial/no-reintentos de GIS_README.md:101.

## 7. Adaptación offline y migración sin cambios observables

1. Antes de código/configuración ejecutable/pruebas, t_84499d2c crea OpenSpec `city-data-download` con proposal, design, tasks y specs derivados de este contrato; ejecuta los gates de AGENTS.md. Este documento es arquitectura previa, no un OpenSpec retroactivo. No se crean configuraciones ejecutables en esta tarea.
2. Registrar SHA-256 de fuente, calles, límite y metadata actuales. Mover bytes al directorio canónico; mantener la copia pública raíz idéntica. No consultar red para la migración: un snapshot nuevo no sirve para demostrar equivalencia.
3. Parametrizar `boundary(source, *, relation_id, reference_point_lonlat)`; sin defaults de Arrecifes en la función común. Mantener exactamente los checks geométricos existentes (ways outer, nodo label ignorado, único Polygon válido, punto interior). Cambiar todas sus llamadas y tests. `build(source, poly)`, LEVEL, agrupación, recorte, redondeo y orden quedan intactos.
4. `uv run extract_gis.py` sin argumentos sigue regenerando Arrecifes offline desde data/arrecifes/ y actualiza su copia pública solo tras transformación satisfactoria. La selección por defecto es del wrapper de compatibilidad, no de funciones comunes. Añadir `--city <slug>` y `--input-dir <staging>` opcional: config desde data/<slug>/city.json, archivos source.json/extract.overpassql desde staging cuando se indique; derivados se escriben allí, sin publicar ni alterar canónicos. Sin --input-dir, derivados en data/<slug>/. Solo la ejecución de compatibilidad para Arrecifes canónico actualiza la copia pública. Ninguna segunda ciudad se activa en el juego.
5. Derivar relation_id en GeoJSON/metadata y punto desde config; endpoint de opciones/procedencia real. Metadata conserva schema_version=1 y significado de campos; query_file será `extract.overpassql` relativo al directorio de metadata. La fuente histórica ya usó ese endpoint/query. Para staging con endpoint alternativo, registrar endpoint en un sidecar de adquisición `acquisition.json` (endpoint, city_slug, source_sha256, query_file) generado por CLI; el extractor valida slug/hash y usa esa procedencia. Sin sidecar, permitir solo snapshot histórico canónico, nunca inferir endpoint de un staging desconocido.
6. Validar antes de publicar los tres niveles no vacíos como ahora (:113). Una ciudad compatible debe satisfacer esa condición y topología existente; otras geometrías/ciudades requieren un cambio GIS separado, no fallback a bbox ni datos inventados. Mantener dump compacto UTF-8/newline y hashes. Preparar derivados en temporales del mismo directorio antes de reemplazar; en un fallo de descarga ni siquiera se invoca transformación.
7. Actualizar test_gis.py para rutas/config, documentación de reproducción y referencias activas. La prueba GIS debe comparar reproducción con el snapshot sin alterar canónicos. No tocar app.mjs, game.mjs, URL pública, mensajes de carga ni allowlist para implementar el movimiento de datos. Comprobar duplicado público en CI/tests.
8. Entregar candidato exacto y worktree limpio a QA; root coordina integración autorizada y pruebas sobre main. Arquitectura completada no significa implementación ni release completados.

## 8. Alta de otra ciudad compatible

Verificar manualmente una relación urbana OSM (no el partido/provincia), su área Overpass y un punto interior. Conservar consultas/resultados de verificación bajo data/<nuevo-slug>/. Crear city.json con cinco campos; no editar download_gis.py ni añadir condicionales por nombre. Ejecutar descarga a staging y transformación offline con --city y --input-dir. Revisar cobertura, atribución, exclusiones, niveles y hashes antes de promover archivos. No incorporar ciudad real nueva al producto en esta entrega.

Tests usarán segunda config sintética (slug `ciudad-prueba`, relation_id distinto y punto distinto) con respuesta simulada consistente, sin hacer pasar fixture por datos reales. Ambas deben atravesar exactamente build_extract_query/download_city/transport; el query, validación de relación y resultado identifican su propia ciudad. No requieren nuevos templates ni clases especializadas.

## 9. Matriz mínima de aceptación para implementador y QA

- Query de Arrecifes exacto y segunda relación interpolada en ambos lugares; POST data, endpoint, UA y timeouts verificables con transporte fake, una invocación por descarga.
- Config inválida, slug traversal, booleano como ID, coordenadas no finitas/fuera de rango y versión desconocida: rechazo antes de red/escritura.
- Éxito conserva bytes, hash, osm3s y metadatos; no normaliza source. Relación equivocada, ausente/duplicada, elements vacío, esquema inválido, HTML/JSON roto y remark: fallo tipado.
- HTTP 406/429/500, timeout, red interrumpida y curl ausente: fallo visible, sin retries ni overwrite; comprobar snapshot canónico y copia pública inmutables. CLI exit no cero y stderr, sin publicar raw parcial.
- Simular fallo de escritura/staging ya existente y verificar que no modifica contenido ajeno. Validar sidecar contra hash/slug y rechazar procedencia desconocida de staging.
- Arrecifes migrada reproduce bytes de calles y límite; fuente movida conserva hash. Metadata conserva conteos/atribución/exclusiones/hash; cualquier cambio de path/procedencia se explica, no se acepta variación GIS.
- Los tests GIS existentes pasan; test nuevo verifica copia pública exacta. npm test y navegador confirman carga/errores existentes; pruebas estáticas confirman que raw/config no se exponen. Ejecutar gates OpenSpec, guard, diff --check y build/smoke Docker si se alteran entradas/build/publicación.
- Buscar constantes 3743598, coordenadas, arrecifes y paths antiguos en código común: tolerar solo wrapper de compatibilidad e identidad histórica del User-Agent, configuración y fixtures específicos. Documentar excepciones, no esconderlas.
- QA sin servicios externos. Una prueba real de red no sustituye los casos simulados ni es requisito para aprobar.

## 10. Evidencia de esta revisión arquitectónica

Sobre ead38d0654beeed77720ccc464169286da250c5a se ejecutaron `npm test` (14/14), `uv run test_gis.py` (11/11) y `git diff --check` (exit 0). Son pruebas de baseline, no del módulo futuro. No se hicieron peticiones Overpass ni cambios en código/configuración/datasets. Único archivo nuevo: este documento, sin commit; el implementador debe incorporarlo a su rama junto con la especificación previa, no asumir que está en main.

Hashes baseline calculados sobre archivos reales:

- arrecifes_source.json: `9db4231faf45553abb7e251670e958a3b7ae5772a223ff57c5208cc98965de40`
- arrecifes_calles.json: `ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e`
- arrecifes_limite.geojson: `0cd2ef2ddd3a3eb3db7d7cc1b635bfa4daeefe16a1705059d8db960877b95f0e`
- arrecifes_metadata.json: `31bf7646d5259615df9e3ef1b175c19a738a7e6cc0a5901b474fba93f1412de7`
