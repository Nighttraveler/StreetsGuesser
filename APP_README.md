# Arrecifes · De memoria

Contrato vigente de rutas (t_2d0104cf): `/` y `/index.html` son portada independiente sin juego; el juego completo está en `/play.html`. Publicar también `play.html` (seis activos estáticos en total), además de los cinco históricos que se detallan abajo. Ver GAME_ROUTE.md para enlaces del landing, prueba local y publicación actual; las rutas del juego en evidencias históricas anteriores quedan sustituidas por `/play.html`.

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
- La calle seleccionada resalta todos sus tramos, incluidos los desconectados. Zoom suave al conjunto, inmediato con preferencia de movimiento reducido. Botones +, −, Vista general y Ver calle disponibles sin gestos.
- Para explorar, mantener presionado el botón principal del mouse sobre el mapa y arrastrar al menos 5 píxeles. El contenido sigue al puntero sin cambiar el zoom ni la ronda; un clic simple no desplaza ni cambia la partida. Soltar (incluso fuera del mapa) o perder el foco termina el gesto. Los controles no inician arrastre y Ver calle recupera el encuadre original. Se conservan los límites de zoom; no existen límites de posición de cámara. No se agregan gestos táctiles ni de rueda.
- Nivel 1 / Fácil: 15 calles principales; nivel 2 / Medio: 13 conexiones intermedias; nivel 3 / Difícil: 145 calles residenciales. Selección exacta, no acumulativa, entre calles aún no acertadas; evita repetición inmediata cuando hay alternativa. Errores, pistas y saltos no retiran calles.
- La calle seleccionada resalta todos sus tramos, incluidos los desconectados. Zoom suave al conjunto, inmediato con preferencia de movimiento reducido. Botones +, −, Vista general y Ver calle disponibles sin gestos.
- Para explorar, mantener presionado el botón principal del mouse sobre el mapa y arrastrar al menos 5 píxeles. El contenido sigue al puntero sin cambiar el zoom ni la ronda; un clic simple no desplaza ni cambia la partida. Soltar (incluso fuera del mapa) o perder el foco termina el gesto. Los controles no inician arrastre y Ver calle recupera el encuadre original. Se conservan los límites de zoom; no existen límites de posición de cámara. No se agregan gestos táctiles ni de rueda.
- Ingresar respuesta y Enter o Comprobar. Se ignoran caja, tildes y prefijos iniciales Av./Av/Avenida/Calle/Dr./Dr/Gral./Gral; no se aceptan subcadenas arbitrarias.
- Acierto: +10, racha +1. Pista: letra inicial y palabras del nombre sin prefijos; acierto con pista +5. Error: puntos conservados, racha cero, se puede reintentar.
- Saltar / Ver respuesta: conserva puntos y reinicia racha. La respuesta queda legible sin temporizador hasta pulsar Siguiente calle. Un acierto también espera Siguiente y no permite sumar dos veces.
- Cambio de nivel reinicia puntos y racha, pero conserva los aciertos únicos propios de cada dificultad durante la partida. Al agotar una dificultad no se selecciona otra calle ni se cambia de nivel automáticamente. No hay persistencia entre recargas (juego de práctica local).
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

## Arrastre táctil del mapa (t_caaef68a)

Vista afectada: SVG `#map` de la sección de juego en `/` y `/index.html`,
compartido por práctica y clasificado, debajo de la portada de ciudades.
Esta actualización sustituye la limitación histórica «no se agregan gestos
táctiles» de las reglas anteriores.

Un dedo arrastra la cámara tras 5px, en cualquier dirección, sin cambiar zoom,
ronda ni puntos. Sólo el SVG usa `touch-action: pinch-zoom`; el resto de la página
conserva scroll nativo. No hay biblioteca de mapas ni capas que bloqueen el
centro: faltaban eventos táctiles. Se usan Pointer Events con captura, se ignoran
eventos mouse de compatibilidad táctil y se conserva el controlador mouse.
Soltar, cancelar, perder captura/foco, ocultar la página, agregar un segundo dedo
o usar un comando de cámara detiene el arrastre; un nuevo gesto vuelve a funcionar.
Dos dedos permiten zoom nativo de página, no zoom de cámara SVG (no existía antes).
Los botones +/−, Vista general y Ver calle siguen disponibles.

Prueba manual para QA:

1. Desde la raíz del worktree, servir únicamente los cinco activos mediante
   la clase allowlist existente (puerto de prueba libre, sin servicio persistente):

       python3 -c 'from pathlib import Path; from serve_static import StaticServer; StaticServer(("127.0.0.1", 18093), Path.cwd()).serve_forever()'

   Abrir `http://127.0.0.1:18093/`; finalizar con Ctrl+C. El catálogo y clasificado
   no están disponibles en este modo de práctica. Para un teléfono físico, QA
   deberá configurar explícitamente acceso de prueba LAN; loopback no es accesible
   desde otro dispositivo. Alternativa con API: RANKINGS_BACKEND.md. No servir todo
   el repositorio con un servidor genérico ni modificar el servicio productivo.
2. Abrir `/`, bajar hasta el mapa de práctica y esperar la calle verde. Arrastrar
   desde el centro con un dedo, sin levantarlo, a derecha, abajo, izquierda,
   arriba y diagonalmente; repetir tras soltar. El mapa debe seguir el dedo y
   la página permanecer quieta. Repetir tras Vista general y +/−.
3. Iniciar el gesto sobre texto fuera del mapa: la página debe desplazarse.
   Pulsar Ver calle para recuperar encuadre y comprobar los demás controles.
4. Agregar otro dedo: no debe seguir paneando como un dedo; pinch amplía la
   página de forma nativa. Volver a un gesto nuevo de un dedo y comprobar pan.
   Cambiar de pestaña durante un gesto y regresar: no debe quedar arrastrando.
5. En escritorio, verificar arrastre principal, clic simple sin pan, botones
   secundarios sin pan y uso del mouse después de un gesto táctil en equipo híbrido.
   Si se dispone del backend, repetir en clasificado (mismo SVG/controlador).

Automatización desde la raíz de este worktree:

    npm ci --ignore-scripts --no-audit --no-fund
    npm test
    npm run test:functional
    node --test --test-name-pattern='táctil|pinch' tests/browser.test.mjs

Los tres escenarios nuevos usan Chromium real headless con viewport 390×844,
`isMobile`/`hasTouch` y contactos CDP (no MouseEvent simulando touch). Cubren pan
continuo y umbral, scroll exterior, taps, captura/cancelación, segundo dedo,
zoom nativo con `visualViewport.scale` y transición touch→mouse. Blur y hidden
son eventos DOM simulados; no equivalen a cambiar de app en un teléfono físico.
Se añade un unitario en tests/game.test.mjs de transformación incremental por
eje y conservación de escala. OpenSpec previo: `touch-map-pan`, commit `c3c5e7c`.
Sin build frontend (estáticos), migraciones, dependencias nuevas ni cambios Docker.
Android real y Safari/iOS quedan a QA hija t_ccb9ee58: emular Chromium no los certifica.

Evidencia de implementación: `1fda3b096a295bb74f0559b710e10099d7f0f850`,
rama `wt/t_caaef68a`, base común `d5e86b46fb413ae255d0b5247eb80ba54cbc17d6`.
Node 22.22.3 / Chromium 151.0.7922.173 en Linux arm64. `npm test`: 34/34;
`npm run test:functional`: 15/15, dos ejecuciones completas verdes consecutivas
(la última incluye umbral touch y transición híbrida). Cobertura game.mjs:
100% líneas/funciones y 98.33% ramas. Gate del cambio válido; validación estricta
global 13/13; guard 7/7; servidor estático 4/4; sintaxis de app y tests y diff check
sin errores. RED inicial por cámara inmóvil. Durante desarrollo se corrigió una
secuencia CDP mal terminada; además hubo un fallo aislado de clics mouse 0/2,
no reproducido en cinco ejecuciones focalizadas y las dos completas posteriores.
Se conserva diagnóstico de eventos en esa aserción para QA; no se atribuye una
causa sin evidencia. Integración y dispositivos reales siguen pendientes.

## Handoff y alcance

### Actualización t_c065e516: navegación con mouse

En el repositorio actual StreetGuesser, el cambio OpenSpec `mouse-map-pan` fue validado y confirmado en `78fd2ad` antes de editar código. Implementación aislada en `wt/t_c065e516`, base común con main `4c451ac03c0b10ebcc7ad6c0d62cce2ea328d280`. Los apartados históricos de esta guía conservan las rutas y evidencia de la entrega inicial.

Verificación de esta actualización:

- `npm test`: 7/7 (dos grupos nuevos: umbral y transformación SVG); red inicial por export inexistente, luego verde.
- `npm run test:functional`: 8/8, dos ejecuciones completas consecutivas. Cuatro escenarios nuevos: arrastre continuo/escala/clics, interrupciones, controles/comandos y cancelación de animación. Blur y visibilidad se simulan mediante eventos del DOM; release fuera y movimientos/botones se ejercitan con mouse real de Playwright.
- `make openspec-validate CHANGE=mouse-map-pan`, `openspec validate --all --strict --no-interactive`: válidos (3 cambios). `make openspec-guard-test`: 7/7. `node --check app.mjs`, `node --check game.mjs` y `git diff --check`: sin errores.
- `python3 -m unittest discover -s tests -p 'test_serve_static.py' -v`: 4/4. `uv run --offline test_gis.py`: 11/11. SHA-256 del dataset inalterado respecto del original indicado arriba.
- `SMOKE_SUBNET=10.254.241.0/28 bash tests/compose-smoke.sh 18092`: build y smoke completos linux/arm64, 9/9 HTTP/Chromium, healthcheck, restricciones, stop/start, recuperación, recreación y rollback offline correctos. Se usó subnet verificada sin solapamiento porque el pool Docker por defecto estaba agotado. Proyecto y etiquetas de prueba eliminados; sin cambios de infraestructura ni producción.
- Fallos de preparación resueltos: ejecutar directamente la suite Compose sin levantar servicio dio conexión rechazada; el runner completo posterior pasó. La primera prueba de escala usaba una posición anterior al cambio de aspecto del SVG: se recalculó el centro antes del gesto, conservando la tolerancia numérica original.

Sin migraciones, dependencias ni cambios GIS; mismo conjunto de cinco estáticos. No probado en Firefox/Safari ni dispositivos físicos. Revisión independiente: `t_548bb6b5`. Integración a main y despliegue no se realizan en esta fase; hashes finales y estado limpio se entregan en Kanban.

### Contrato de progreso (t_25ef22af)

OpenSpec `exclude-solved-streets` amplía las reglas históricas anteriores sin modificar GIS. `game.mjs` exporta:

- `streetId(street)`: identidad de entidad derivada de `osm_way_ids` únicos ordenados numéricamente y unidos por coma; no depende de nombre, índice o instancia. Estable dentro del dataset, no entre futuras reediciones de OSM. La carga rechaza IDs vacíos, inválidos o entidades con identidad duplicada.
- `initialState(solvedByLevel = {})`: estado con marcadores y objeto de arrays de IDs por nivel. Omitir argumento crea partida nueva. Pasar `state.solvedByLevel` conserva progreso al reiniciar marcadores.
- `updateState(state, event, street = null)`: en `correct` con contexto agrega el ID una sola vez al nivel de la calle, sin mutar el estado previo; duplicados tampoco suman puntos. El contexto opcional conserva el uso histórico de puntuación aislada; el controlador siempre pasa la calle al responder.
- `getProgress(streets, level, state)`: `{ correct, total, completed }`, IDs únicos de ese nivel; un nivel inexistente retorna 0/0 con `completed: false`.
- `selectStreet(streets, level, previous = null, random = Math.random, solvedIds = [])`: pasar `state.solvedByLevel[level]` como quinto argumento. Retorna `null` al agotar un nivel existente; nivel inexistente sigue lanzando error. Última pendiente puede repetirse si antes fue saltada.

La UI oculta Siguiente y deshabilita respuestas al completar; al regresar a un nivel agotado muestra completado sin calle activa. QA final t_d8830d6a revisará la cadena completa antes de integrar. No hay migraciones ni despliegue.

### Contador y ascenso voluntario (t_89aabed0)

OpenSpec `show-progress-and-level-advance`, especificado y comprometido antes de implementar sobre el candidato `2cee184`, incorpora:

- Contador visible `acertadas/total` de la dificultad activa: 0/15 a 15/15, 0/13 a 13/13 y 0/145 a 145/145. Usa `getProgress`, no puntos ni racha. Región live polite/atomic, oculta durante carga inicial.
- Al completar mantiene la última respuesta, el total completo y el mensaje de finalización. No selecciona otra calle ni cambia automáticamente. El botón `Subir a 2 · Medio` o `Subir a 3 · Difícil` permite aceptar explícitamente (también con Enter); ignorarlo deja el nivel intacto. El selector sigue disponible.
- Aceptar restaura el progreso propio del destino (por ejemplo, 1/13 si ya hubo un acierto medio), reinicia puntos/racha y enfoca respuesta. Regresar a un nivel agotado conserva contador completo y oferta válida. En Difícil completo no hay oferta inválida; foco al selector.
- `nextLevel(level, configuredLevels)` en game.mjs devuelve el siguiente valor de la lista ordenada o `null` al final/nivel desconocido. La UI pasa los valores string de opciones habilitadas; no asume niveles consecutivos ni vuelve al primero.

Pruebas actuales, desde la raíz del worktree con Node 22+, Chromium y uv:

    npm ci --ignore-scripts --no-audit --no-fund
    npm test
    npm run test:functional
    node --test --experimental-test-coverage tests/game.test.mjs
    uv run --offline test_gis.py
    make openspec-validate CHANGE=show-progress-and-level-advance
    openspec validate --all --strict --no-interactive
    make openspec-guard-test

Resultado de implementación: 10 unitarias, 7 Chromium y 11 GIS pasan. Las funcionales recorren todos los aciertos de los tres niveles reales, errores/pista/saltos/doble envío sin incrementar contador, aceptación por teclado y clic, restauración entre niveles, ausencia de avance automático y máximo sin oferta. El helper cubre configuración no consecutiva, vacía y nivel desconocido. Cobertura game.mjs: líneas/funciones 100%, ramas 98.11%. Se observó RED antes del código: export nextLevel y elemento #progress inexistentes. La captura generada `test-results/completed-mobile.png` fue inspeccionada: 13/13 y botón Difícil legibles sin desborde a 375px; no se versiona. Sin build frontend (archivos estáticos), sin cambios ni build Docker. No se probó dispositivo físico ni otros motores de navegador. Progreso sólo en memoria. QA e integración siguen pendientes; esta fase no publica ni modifica main.

Diseño previo: `/home/fer/projects/juego-calles-arrecifes/APP_SPEC.md`.
Nuevos: APP_SPEC.md, index.html, styles.css, game.mjs, app.mjs, package.json, package-lock.json, tests/game.test.mjs, tests/browser.test.mjs, APP_README.md, APP_TEST_RESULTS.txt y capturas en test-results/. node_modules es instalación local de tooling, no entregable publicable.
No se editaron datos GIS, no hay migraciones ni eliminaciones. Esta tarjeta usa explícitamente un directorio nuevo sin repositorio, no el repositorio Lawyers Hub: no hay rama, merge-base, commits ni cambio OpenSpec de ese proyecto. No se inicializó Git ni se modificó main.

Pendiente de QA: revisión independiente de implementación/datos y configuración de servidor persistente ligado a IP LAN verificada. Verificación de móvil mediante emulación Chromium, no un celular físico. No se probó Safari/Firefox. Se preservan las limitaciones cartográficas del GIS; no certifica cobertura de todas las calles existentes.
