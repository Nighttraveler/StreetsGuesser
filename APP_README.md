# Arrecifes · De memoria

Entrega de implementación de t_edec234d. Revisión independiente y servidor persistente: t_a5e4f54c (QA).

## Entrada y archivos publicables

Directorio fuente absoluto: `/home/fer/projects/juego-calles-arrecifes`.
Entrada: `/home/fer/projects/juego-calles-arrecifes/index.html`.

Publicar **únicamente estos cinco archivos**, juntos en la raíz de un directorio dedicado:

1. `/home/fer/projects/juego-calles-arrecifes/index.html`
2. `/home/fer/projects/juego-calles-arrecifes/styles.css`
3. `/home/fer/projects/juego-calles-arrecifes/game.mjs`
4. `/home/fer/projects/juego-calles-arrecifes/app.mjs`
5. `/home/fer/projects/juego-calles-arrecifes/arrecifes_calles.json`

No copiar ni servir el directorio de trabajo entero: contiene fuente raw OSM, metadatos, herramientas, pruebas y node_modules que no necesita el juego. No requiere build, npm ni Python en el cliente. npm/Playwright se usan únicamente para pruebas. No usa CDN, fuentes remotas, mapas externos, claves, almacenamiento remoto ni cookies. Los enlaces visibles de atribución solo abren la web OSM si el usuario los pulsa.

Ejemplo de preparación y prueba local para QA (sin persistencia; elegir un directorio nuevo y un puerto libre):

    cd /home/fer/projects/juego-calles-arrecifes
    mkdir /home/fer/projects/juego-calles-arrecifes-public
    cp index.html styles.css game.mjs app.mjs arrecifes_calles.json /home/fer/projects/juego-calles-arrecifes-public/
    python3 -m http.server 8080 --bind 127.0.0.1 --directory /home/fer/projects/juego-calles-arrecifes-public

Abrir `http://127.0.0.1:8080/` en ese equipo, no `file://`. Para celular, QA debe verificar IP LAN y servicio persistente siguiendo su tarjeta; esta etapa no publica en LAN ni configura servicios. No se afirma una prueba desde otro dispositivo.

La aplicación solicita `./arrecifes_calles.json` desde el mismo origen que el índice, también funciona bajo un subdirectorio HTTP. El servidor debe servir `.mjs` como JavaScript (`text/javascript` o `application/javascript`); Python http.server lo soporta. Si falla la carga, muestra la causa HTTP/formato/timeout y un botón de reintento, sin datos ficticios.

## Datos y límites

Se consume el array GIS intacto, no GeoJSON; cada `segmentos[].coordenadas` en [lon, lat] es un path SVG separado. Son 173 entidades / 407 segmentos. Norte arriba, proyección local equirectangular corregida por coseno de latitud central; adecuada para reconocimiento urbano, no navegación. Sin nombres en el SVG ni mosaicos. © OpenStreetMap contributors, ODbL, visible en el mapa.

Consultar `/home/fer/projects/juego-calles-arrecifes/GIS_README.md` para trazabilidad y limitaciones de cobertura. SHA-256 original conservado:

    ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e

El nombre canónico es `Avenida Carlos Merlassino`. Se aceptan explícitamente `merlassino` y `av merlassino` sin renombrar GIS ni eliminar nombres propios de otras calles. No confundir Avenida Belgrano con Crucero General Belgrano.

## Reglas y controles

- Nivel 1 / Fácil: 15 calles principales; nivel 2 / Medio: 13 conexiones intermedias; nivel 3 / Difícil: 145 calles residenciales. Selección exacta, no acumulativa, uniforme entre opciones salvo exclusión de la calle anterior para evitar repetición inmediata.
- La calle seleccionada resalta todos sus tramos, incluidos los desconectados. Zoom suave al conjunto, inmediato con preferencia de movimiento reducido. Botones +, −, Vista general y Ver calle; no requiere gestos ni arrastre.
- Ingresar respuesta y Enter o Comprobar. Se ignoran caja, tildes y prefijos iniciales Av./Av/Avenida/Calle/Dr./Dr/Gral./Gral; no se aceptan subcadenas arbitrarias.
- Acierto: +10, racha +1. Pista: letra inicial y palabras del nombre sin prefijos; acierto con pista +5. Error: puntos conservados, racha cero, se puede reintentar.
- Saltar / Ver respuesta: conserva puntos y reinicia racha. La respuesta queda legible sin temporizador hasta pulsar Siguiente calle. Un acierto también espera Siguiente y no permite sumar dos veces.
- Cambio de nivel reinicia puntos y racha. No hay persistencia de marcadores entre recargas (juego de práctica local).
- Etiquetas de formulario, mensajes live, foco visible, controles de al menos 44px de alto, input de 16px para móvil y diseño en una columna en pantallas pequeñas.

## Pruebas reproducibles

Desde `/home/fer/projects/juego-calles-arrecifes` con Node 22+, Chromium y uv para GIS:

    npm ci --ignore-scripts --no-audit --no-fund
    npm test
    npm run test:functional
    node --check app.mjs
    node --check game.mjs
    uv run --offline test_gis.py
    sha256sum arrecifes_calles.json
    npm audit --omit=optional

Playwright está fijado en package-lock.json. Usa `/usr/bin/chromium` (override `CHROMIUM_PATH`); en esta Pi se ejecutó Chromium 151.0.7922.173. Los argumentos `--no-sandbox` y `--disable-dev-shm-usage` son exclusivamente del runner local de pruebas; no configuran el navegador del jugador. La primera instalación de tooling requiere npm/red; el juego no.

Rutas de pruebas:

- `/home/fer/projects/juego-calles-arrecifes/tests/game.test.mjs`: 5 grupos unitarios explícitos, cubren normalización/prefijos/alias/rechazos, selección de los tres niveles y extremos RNG, no repetición, puntos/racha/error/salto/pista/doble envío y texto de pista.
- `/home/fer/projects/juego-calles-arrecifes/tests/browser.test.mjs`: 4 pruebas funcionales con navegador real: mismo origen, 407 paths, todos los tramos activos, mapa sin etiquetas, atribución, alias Merlassino por Enter, error, pista, acierto, salto estable, Siguiente, niveles, Ricardo Gutiérrez sin tildes, reinicio, zoom normal/reducido, viewport 375×812 sin desborde, controles y carga fallida recuperable. Detecta errores JS/consola y peticiones externas en los recorridos válidos. El escenario de error provoca intencionalmente un HTTP 503.
- `/home/fer/projects/juego-calles-arrecifes/test_gis.py`: 11 pruebas GIS existentes, sin modificar.

El runner funcional crea un servidor HTTP loopback en puerto efímero con lista permitida de solo los cinco estáticos, y lo cierra junto al navegador al terminar. No deja daemon. Resultados efectivos y versiones en `/home/fer/projects/juego-calles-arrecifes/APP_TEST_RESULTS.txt`.

Capturas reales generadas por las pruebas e inspeccionadas visualmente:

- `/home/fer/projects/juego-calles-arrecifes/test-results/desktop.png` (1280×1000).
- `/home/fer/projects/juego-calles-arrecifes/test-results/mobile.png` (375×812, página completa).

## Handoff y alcance

Diseño previo: `/home/fer/projects/juego-calles-arrecifes/APP_SPEC.md`.
Nuevos: APP_SPEC.md, index.html, styles.css, game.mjs, app.mjs, package.json, package-lock.json, tests/game.test.mjs, tests/browser.test.mjs, APP_README.md, APP_TEST_RESULTS.txt y capturas en test-results/. node_modules es instalación local de tooling, no entregable publicable.
No se editaron datos GIS, no hay migraciones ni eliminaciones. Esta tarjeta usa explícitamente un directorio nuevo sin repositorio, no el repositorio Lawyers Hub: no hay rama, merge-base, commits ni cambio OpenSpec de ese proyecto. No se inicializó Git ni se modificó main.

Pendiente de QA: revisión independiente de implementación/datos y configuración de servidor persistente ligado a IP LAN verificada. Verificación de móvil mediante emulación Chromium, no un celular físico. No se probó Safari/Firefox. Se preservan las limitaciones cartográficas del GIS; no certifica cobertura de todas las calles existentes.
