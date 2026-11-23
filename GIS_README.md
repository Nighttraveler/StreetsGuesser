# Entrega GIS — Arrecifes

Snapshot histórico obtenido y validado el 2026-11-19 UTC. Esta documentación sustituye el bloqueo histórico de GIS_BLOCKER.txt. La fuente final sí fue obtenida de Overpass, no de la API de edición ni de datos inventados. La organización y adquisición reutilizable posteriores siguen CITY_DOWNLOAD_SPEC.md y OpenSpec city-data-download. GIS_TEST_RESULTS.txt, GIS_HANDOFF.json y GIS_BLOCKER.txt son evidencia histórica, no resultados de la versión actual.

## Resultado y archivos

Directorio canónico actual: data/arrecifes/ relativo al repositorio StreetGuesser. No publicar este árbol.

- city.json: identidad declarativa, relación urbana y punto de referencia lon/lat.
- calles.json: contrato para el desarrollador, UTF-8 compacto, 114481 bytes. La copia pública generada arrecifes_calles.json sigue en la raíz, idéntica byte a byte; no editarla manualmente.
- metadata.json: procedencia, hashes SHA-256, conteos y exclusiones individuales.
- source.json: respuesta original Overpass con geometrías completas y versiones OSM.
- limite.geojson: polígono exacto usado para recortar, WGS84.
- discover.overpassql y discover-retry.json: descubrimiento exitoso de la localidad.
- verify-area.overpassql y verify-area.json: verificación de jerarquía administrativa.
- extract.overpassql: consulta final reproducible.
- En la raíz: download_gis.py (biblioteca/CLI Python >=3.11 con curl); extract_gis.py (transformación offline, Shapely 2.1.2); test_download_gis.py y test_gis.py (pruebas sin red).

173 entidades lógicas; 407 vías incluidas y 407 segmentos después del recorte. Niveles: 1/Fácil = 15; 2/Medio = 13; 3/Difícil = 145. Ningún nivel vacío. Fuente inicial: 414 vías con highway y name; 7 excluidas con motivo registrado en metadata. Se excluyeron service, motorway, footway y path; también el marcador `Calle S/N` (way 98251701), que no identifica una calle con nombre real. No se asignaron niveles ficticios a clases no elegibles.

## Identidad y recorte urbano verificable

Localidad: nodo https://www.openstreetmap.org/node/198439470, place=town, Arrecifes, Buenos Aires, Argentina; punto lon=-60.1087380, lat=-34.0674983, Wikidata Q2706121.

Se encontró un área propia de la localidad: relación https://www.openstreetmap.org/relation/3743598, name=Arrecifes, boundary=administrative, admin_level=8, versión 9. NO es el partido. La consulta is_in del punto devuelve además Partido de Arrecifes, área 3602455558 (relación 2455558), admin_level=5, y Buenos Aires admin_level=4 / Argentina admin_level=2. Esa jerarquía está preservada en data/arrecifes/verify-area.json. No se usó el partido ni un bbox inventado como delimitación urbana.

El límite de la localidad se construye con los 18 miembros way/outer de la relación. Se exige un único polígono válido, sin bordes colgantes ni anillos abiertos y que contenga el nodo de la localidad; el miembro label no participa de la geometría. Se exporta íntegro en data/arrecifes/limite.geojson. Extensión del polígono, en orden oeste/sur/este/norte:
[-60.1353677, -34.0919954, -60.0665664, -34.0411583].

La consulta selecciona way["highway"]["name"] en el área 3603743598 y usa `out meta geom` sin bbox: conserva en la fuente las geometrías completas. Después se intersecta cada línea con el polígono local antes de redondear, evitando que las rutas que atraviesan la localidad prolonguen el mapa por el campo. NO se recorta al mero rectángulo de extensión. Si una vía sale y reentra, cada parte se conserva separadamente. No se unen extremos de vías ni se inventan conexiones.

Limitación: se adopta el límite administrativo OSM de la localidad como alcance del juego, no una delimitación catastral ni un relevamiento de toda la mancha edificada. La selección depende de los datos y áreas de Overpass, cuyas fechas se registran separadamente. No certifica que OSM contenga todas las calles existentes. El redondeo puede desplazar puntos de borde hasta aproximadamente 0.0000071 grados en distancia euclídea; las pruebas usan tolerancia 0.000008 grados, no afirman que cada punto redondeado quede estrictamente dentro del polígono.

## Contrato de datos v1

La raíz de arrecifes_calles.json es un array, no un objeto GeoJSON. Cada entidad tiene:

- nombre: string; nombre original OSM elegido de forma determinista, sin abreviar ni corregir ortografía.
- nivel: entero 1, 2 o 3.
- nombres_originales: array de todos los valores name de las vías incluidas en la entidad.
- clases: array ordenado de valores highway elegibles presentes.
- osm_way_ids: array de IDs OSM numéricos únicos, ascendente.
- segmentos: array de objetos {osm_way_id, highway, coordenadas}.
- coordenadas: array de posiciones [longitud, latitud] WGS84; cada segmento tiene al menos dos puntos distintos y longitud positiva. No invertir latitud/longitud. Renderizar cada segmento como una línea independiente.

La raíz se ordena por clave de nombre: Unicode NFC + casefold + espacios colapsados. Se agrupan todas las vías con esa misma clave, aunque estén desconectadas. Los nombres originales se conservan intactos; si hubiera variantes de espacios/caja, nombre sería el primero de nombres_originales ordenados por Unicode. No se quitan apellidos, acentos ni prefijos para agrupar: podrían representar calles distintas. La prueba adicional con normalización flexible de prefijos/acentos no detectó colisiones en esta entrega.

Dentro de cada entidad los segmentos se ordenan por osm_way_id y luego coordenadas lexicográficamente. Una vía recortada en varias partes puede repetir su ID en segmentos; osm_way_ids siempre es único. El recorrido de cada línea no implica sentido autorizado de circulación. Este dataset sirve para reconocimiento visual, no para navegación.

Coordenadas redondeadas mediante round(valor, 5), eliminando vértices consecutivos iguales; fragmentos colapsados sin dos vértices se descartan. JSON numérico no conserva ceros finales: 5 decimales significa precisión máxima, no longitud fija de la representación.

Clasificación: primary/secondary/trunk => 1; tertiary/unclassified => 2; residential => 3. Si una entidad tiene varias clases elegibles, nivel = mínimo numérico. Las clases no elegibles no aportan geometrías ni cambian el nivel. Las exclusiones conservan IDs/nombres/clases en metadata y todas las etiquetas siguen disponibles en la fuente original.

Consumo JavaScript: después de fetch('./arrecifes_calles.json'), iterar entidad.segmentos y dibujar segmento.coordenadas; para resaltar una calle, resaltar TODOS sus segmentos. La atribución debe mostrarse en la app, no solo en este documento.

## Ejemplos pedidos y evidencia

- Av. Belgrano: denominación OSM `Avenida Belgrano`, nivel 1, clase secondary. IDs 73533256, 98251785, 147456011, 147456012, 271954597, 1346205388, 1346205391. Ejemplo: https://www.openstreetmap.org/way/73533256 . `Crucero General Belgrano` es otra entidad y no se fusiona.
- Av. Merlassino: denominación OSM `Avenida Carlos Merlassino`, no `Avenida Merlassino`. Clases secondary y tertiary, nivel resultante 1. Ejemplo secondary: https://www.openstreetmap.org/way/73688795 ; ejemplo tertiary: https://www.openstreetmap.org/way/98251743 . Este último además trae alt_name=`Avenida Dr. Carlos Merlassino`. Todos los IDs están en osm_way_ids. No se renombró la fuente para ajustarla al ejemplo del pedido.
- Ricardo Gutiérrez: nombre exacto `Ricardo Gutiérrez`, residential, nivel 3, vía https://www.openstreetmap.org/way/73688764 .

Aviso para desarrollo: quitar solamente el prefijo Avenida no hará que `merlassino` coincida con `Carlos Merlassino`. Si el juego debe aceptar ese ejemplo, implementar un alias explícito de respuesta para esta entidad, sin modificar el nombre canónico ni generalizar la eliminación arbitraria de nombres propios. La ausencia del literal `Avenida Merlassino` se refiere a esta extracción, no a una búsqueda mundial.

## Fuente y atribución

Endpoint: https://overpass-api.de/api/interpreter
Motor reportado: Overpass API 0.7.62.11 87bfad18.
Fecha base OSM final: 2026-11-19T22:37:35Z.
Fecha base áreas final: 2026-11-19T16:26:38Z.
Las fechas de modificación de cada objeto están en data/arrecifes/source.json; no confundirlas con la fecha global del snapshot. Las respuestas de descubrimiento/verificación se adquirieron en peticiones separadas y tienen su propia fecha.

© OpenStreetMap contributors — datos bajo ODbL 1.0.
https://www.openstreetmap.org/copyright
https://opendatacommons.org/licenses/odbl/1-0/

La fuente raw incluye metadatos públicos de editores OSM. No es necesaria para publicar el juego; se conserva como evidencia de extracción. Publicar solamente los estáticos requeridos por la app y su atribución, no todo el directorio de trabajo.

## Reproducción

Desde la raíz del checkout (los CLI resuelven configuración respecto al módulo, no al cwd):

1. Reproducir exactamente la transformación del snapshot conservado, sin red:

   uv run extract_gis.py
   uv run test_gis.py
   sha256sum arrecifes_calles.json

SHA-256 esperado: ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e
SHA-256 fuente: 9db4231faf45553abb7e251670e958a3b7ae5772a223ff57c5208cc98965de40

Se ejecutó el extractor dos veces y el hash de salida permaneció idéntico. uv instala Shapely 2.1.2 según los metadatos PEP 723 del script; requiere conectividad inicial si no está en caché. No se requiere instalar dependencias para consumir el JSON en el navegador.

2. Para una NUEVA extracción, usar un destino inexistente fuera de data/ (no se promueve automáticamente):

   python3 download_gis.py --city arrecifes --output-dir /ruta/nueva/staging-arrecifes
   uv run extract_gis.py --city arrecifes --input-dir /ruta/nueva/staging-arrecifes

La descarga hace un único POST y escribe source.json y extract.overpassql exactos más acquisition.json (endpoint, city_slug, source_sha256, query_file). La transformación verifica procedencia y genera calles.json, limite.geojson y metadata.json allí, sin tocar canónicos ni copia pública. Revisar y promover snapshots es un paso manual separado, fuera de este CLI. El wrapper sin argumentos sigue regenerando los canónicos de Arrecifes y su copia pública offline. Sin sidecar sólo se admite la fuente histórica canónica cuyo hash está registrado; un staging desconocido nunca hereda un endpoint supuesto.

Opciones explícitas: --endpoint (HTTPS sin credenciales/fragmento), --user-agent, --connect-timeout-seconds (15), --total-timeout-seconds (150), --query-timeout-seconds (120). User-Agent histórico: ArrecifesStreetStudy/1.0 (one-off GIS extraction), identidad del cliente, no selector de ciudad. La biblioteca exporta CityConfig, DownloadOptions, OverpassRequest, DownloadResult; download_city recibe configuración y transporte inyectable, no escribe ni imprime. build_extract_query es puro. load_city_config rechaza claves desconocidas/duplicadas, versiones no admitidas, relación booleana o no positiva, slug inseguro y coordenadas inválidas antes de red.

Errores DownloadError estables: config, transport (incluye curl ausente), timeout, http, invalid_json, invalid_response, overpass_remark, io. CLI: stderr conciso y exit no cero, sin publicar bytes parciales ni sobrescribir destino existente. curl no usa shell, redirects ni retries; no registra payloads de editores. Preparación de derivados en temporales antes de reemplazarlos, cada replace atómico; no es una transacción conjunta resistente a corte de energía durante múltiples reemplazos.

No ejecutar consultas en paralelo ni hacer reintentos continuos. Ante 406/429 esperar al menos 30 segundos (respetar Retry-After si es mayor) y comprobar la política vigente del servidor. Ante errores o remark no publicar la salida. Ningún bucle de espera/reintento es automático.

3. Alta futura compatible: verificar manualmente relación urbana, jerarquía y punto interior; guardar evidencia de descubrimiento/verificación bajo data/<slug>/. Los archivos discover.overpassql y verify-area.overpassql actuales son evidencia específica de Arrecifes, no templates automáticos. Crear data/<slug>/city.json con exactamente schema_version=1, slug ASCII kebab-case, name no vacío, boundary_relation_id entero positivo y reference_point_lonlat=[lon,lat]. Ejecutar los mismos comandos con --city <slug>, sin editar el módulo. Sólo admite el polígono/topología y clases existentes, y requiere tres niveles no vacíos. No activa ninguna ciudad nueva en el juego ni garantiza soporte para toda topología OSM.

## Pruebas ejecutadas

Resultado histórico: uv run test_gis.py > GIS_TEST_RESULTS.txt 2>&1 produjo 11 tests OK en la entrega inicial. No sobrescribir ese informe como si fuera actual.

Verificación actual reproducible, sin servicios externos:

   python3 -m unittest test_download_gis -v
   uv run test_gis.py
   python3 -m unittest discover -s tests -p 'test_serve_static.py' -v
   npm test
   npm run test:functional

Las pruebas nuevas verifican ambas configuraciones por el mismo módulo, errores HTTP/timeout/red/JSON/remark/config, staging sin overwrite, procedencia, reproducción temporal con hashes y copia pública idénticos. HTTP raw/config devuelve 404. No se cambia app.mjs ni allowlist/imagen; únicamente el JSON raíz público se consume en producción.

Cobertura explícita: agrupamiento de vías desconectadas; clasificación de las seis clases elegibles y rechazo de otras; mínimo nivel en clases mixtas; precisión decimal y eliminación de vértices colapsados; recorte con división en partes; nombres vacíos/marcadores; unicidad lógica, IDs y orden; validez y trazabilidad geométrica contra la fuente; ausencia de geometrías exactamente duplicadas (también invertidas); cobertura completa de vías fuente entre incluidas/excluidas; localidad distinta del partido; nombres de los tres ejemplos. Fixture sintético se usa solo en unit tests, nunca en la entrega.

## Decisiones y alternativas

A. Área OSM propia de localidad + recorte geométrico (elegida).
Ventaja: límite identificable/versionado y exclusión de prolongaciones rurales. Costo: un pequeño extractor GIS y dependencia Shapely solo al generar. Desventaja: hereda la calidad del límite OSM. Reversible: regenerar desde la fuente original y cambiar el polígono, sin alterar el contrato.

B. Área del partido + bbox urbano manual (descartada).
Ventaja: utilizable cuando falta el límite local. Desventaja: esquinas arbitrarias y mayor riesgo de incluir campo/excluir barrios. Costo: verificación cartográfica manual adicional. Reversible: alta si se guarda la fuente, pero no hace falta porque existe el área de localidad.

Se mantiene Overpass según el pedido; la alternativa API v0.6 no fue necesaria.
