# Especificación de despliegue Compose — t_e3854ae8

Estado: las secciones 1–6 conservan el diseño histórico de t_e3854ae8. La sección 7 registra la decisión posterior del usuario sobre el servidor de la imagen. No se modifica systemd en esta etapa.

Actualización t_2d0104cf, OpenSpec `separate-game-route`: el conjunto publicable pasa de cinco a seis activos al agregar `play.html`. `/` y `/index.html` entregan portada independiente sin scripts; `/play.html` entrega el juego. COPY y allowlists siguen siendo explícitos, sin fallback ni exposición del checkout. Esta actualización sustituye las referencias históricas a cinco activos en este documento; no cambia seguridad, puertos, runtime Python, ni autoriza despliegue. Contrato vigente: GAME_ROUTE.md y DEPLOYMENT.md.

## 1. Inventario verificado

Actualización estructural t_c591d950, OpenSpec `separate-frontend-backend`: las fuentes publicables viven en frontend/ y el lanzador en backend/serve_static.py. Docker conserva seis basenames en /srv/arrecifes/public/ y el entrypoint /srv/arrecifes/serve_static.py, mediante COPY y contexto explícitos; no cambia runtime ni allowlist HTTP. compose.yaml se conserva íntegro, incluido su bind default 0.0.0.0 y red externa proxy actuales: las secciones históricas de bridge propia/loopback no describen ese archivo vigente. No ejecutar el runner Compose histórico esperando ese modelo; ver GAME_ROUTE.md y REPOSITORY_LAYOUT.md para ensayo aislado. No se autoriza despliegue.

- Fuente: `/home/fer/projects/juego-calles-arrecifes`; no es un repositorio Git (git status falla por ausencia de .git). No inicializar Git como parte de este cambio.
- Unidad de usuario habilitada: `/home/fer/.config/systemd/user/arrecifes-de-memoria.service`. Líneas 5–9: Type=simple, ExecStart directo, Restart=on-failure, RestartSec=2. Líneas 3 y 12: After=network-online.target y WantedBy=default.target.
- Comando real (línea 7): `/usr/bin/python3 -m http.server 8090 --bind 192.168.0.105 --directory /home/fer/projects/arrecifes-de-memoria-public`.
- systemctl --user show: active/running, PID 1726631 al inspeccionar, sin drop-ins; WorkingDirectory efectivo `!/home/fer`. No hay Environment/EnvironmentFile ni referencias a secretos en la unidad. No se leyeron entornos del proceso, .env ni credenciales.
- ss confirma ese proceso escuchando exclusivamente TCP 192.168.0.105:8090. El juego no necesita UDP, WebSocket, TLS propio ni otros puertos. No confundir con 8080, 80 y 443, ocupados por otros servicios del host.
- Directorio publicado real: `/home/fer/projects/arrecifes-de-memoria-public` (NO el directorio `juego-calles-arrecifes-public` del ejemplo antiguo). Contiene exactamente index.html, styles.css, game.mjs, app.mjs y arrecifes_calles.json.
- Los cinco SHA-256 del directorio publicado coinciden con las fuentes. Dataset: `ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e`.
- APP_README.md:10–18 define esos cinco publicables; :29 define MIME JavaScript para .mjs; :48 confirma ausencia de persistencia de marcadores. app.mjs:159–179 carga el JSON relativo del mismo origen. No hay DB, sesiones de servidor, uploads ni datos mutables que migrar.
- package.json:6–11 solo contiene scripts de pruebas y Playwright como devDependency; no existe npm start ni fase de build. No se encontró wrapper propio de arranque; la unidad ejecuta Python directamente. Los scripts de node_modules son tooling, no runtime del juego.
- Host observado: aarch64; Docker 26.1.5+dfsg1 y Compose 2.26.1-4; acceso al daemon confirmado con docker info (linux/aarch64).

## 2. Opciones y decisión

A. Imagen propia estática sobre Nginx Alpine (RECOMENDADA).
  Pros: artefacto autocontenido, sin rutas absolutas del host, publicación limitada y actualización/rollback por imagen.
  Contras: requiere Dockerfile y configuración explícita de MIME/permisos; cambios de contenido requieren rebuild.
  Coste estimado: medio día de implementación/verificación; sin infraestructura nueva, mantenimiento periódico de imagen base.
  Reversibilidad: alta; los mismos cinco archivos funcionan en cualquier servidor HTTP.

B. Nginx con bind mount read-only del directorio publicado.
  Pros: cambios de archivos sin rebuild y configuración inicial breve.
  Contras: depende de la preparación y ubicación del directorio del host, despliegue no atómico y respaldo separado; no cumple tan bien «imagen lista».
  Coste estimado: unas horas; mismo coste de infraestructura, más disciplina operativa sobre archivos.
  Reversibilidad: alta, pasando esos archivos a COPY en Dockerfile.

C. Imagen Python conservando http.server.
  Pros: mínima diferencia respecto del servicio actual.
  Contras: servidor de desarrollo, runtime innecesario y riesgo de exposición de directorios si se monta la fuente completa.
  Coste estimado: unas horas; infraestructura sin coste adicional, menor calidad operativa.
  Reversibilidad: alta; contenido estático independiente del servidor.

Decisión: A. No añadir Node, Python, Postgres, Redis, MinIO ni Traefik como dependencias del juego. La integración futura con proxy es opcional y fuera del alcance.

## 3. Contrato de implementación

Archivos a crear: Dockerfile, compose.yaml, nginx.conf, .dockerignore, .env.example y guía operativa (por ejemplo DEPLOYMENT.md). Mantener datos GIS y lógica del juego intactos.

### Imagen

- Base oficial `nginx:stable-alpine`, resuelta durante implementación a versión concreta + digest de índice multi-arquitectura verificado; registrar referencia exacta en Dockerfile y guía. No inventar un digest ni dejar latest. Actualizarlo deliberadamente con pruebas.
- Construcción local mediante build.context `.` y etiqueta `arrecifes-de-memoria:local`. Compose debe incluir build e image y `pull_policy: never` para no intentar descargar esa etiqueta privada inexistente. `docker compose up -d` en un checkout/directorio preparado construye si falta la imagen; para cambios posteriores usar `docker compose up -d --build`.
- No se presupone registry. Documentar `docker image save` / `docker image load` para distribución offline, indicando arquitectura y etiqueta. El primer build necesita acceso al registry de la base; offline requiere imagen preconstruida cargada.
- Sin `platform: linux/amd64`: build nativo en linux/arm64 de esta Pi. Compatibilidad amd64 solo se afirmará si se verifica; no es requisito publicar un manifest multiarch en esta etapa.
- COPY explícito exclusivamente de los cinco estáticos a `/usr/share/nginx/html/`, eliminando contenido web de ejemplo de la base. Copiar nginx.conf a `/etc/nginx/nginx.conf`. No usar COPY . del proyecto.
- .dockerignore por lista permitida: únicamente Dockerfile, nginx.conf y esos cinco estáticos entran al contexto. Excluir .env, node_modules, backups, pruebas, capturas y raw OSM.
- Ejecutar como usuario no root `nginx`; no privilegiado, sin socket Docker. Usar entrypoint directo `nginx` y comando `["-g", "daemon off;"]` para evitar scripts de entrypoint que intenten modificar /etc en runtime.
- nginx.conf completo: sin directiva user que requiera root, pid en /tmp/nginx.pid, temporales HTTP en /tmp, logs a stdout/stderr, listen 8080, root indicado, index index.html, autoindex off y try_files con 404 real. Sin fallback de rutas desconocidas al índice.
- Tipos explícitos html=text/html, css=text/css, mjs=application/javascript, json=application/json; no depender del mime.types de la base para mjs. Cache-Control no-cache para evitar mezcla de versiones (no hay nombres con hash). Preservar atribución OSM.

### Compose y configuración

- Proyecto `arrecifes-de-memoria`; un servicio `web`, red bridge propia, sin container_name ni depends_on ni network_mode host. Sin red externa obligatoria.
- Única publicación `${BIND_IP:-127.0.0.1}:${HTTP_PORT:-8090}:8080/tcp`. Defaults seguros, portables y no expuestos en todas las interfaces. .env.example documenta BIND_IP y HTTP_PORT, sin secretos. No env_file dentro del contenedor: son variables de interpolación Compose, no configuración de la app.
- Para conservar la URL LAN existente, configurar explícitamente BIND_IP=192.168.0.105 y HTTP_PORT=8090 antes del corte. Verificar que esa IP siga asignada; no usar 0.0.0.0 inadvertidamente. La ruta .env local no se publica ni se incluye en la imagen.
- `restart: unless-stopped`, `read_only: true`, tmpfs `/tmp` con límite 16 MiB y permisos para el usuario nginx, `cap_drop: [ALL]`, security_opt no-new-privileges:true. Ningún volumen persistente ni bind mount necesario. Validar que pid/temporales funcionan bajo estas restricciones.
- Logs json-file con max-size 10m y max-file 3 (o driver local con límites equivalentes documentados). No montar /var/log del host.
- Healthcheck interno HTTP a http://127.0.0.1:8080/ usando wget disponible en la base (verificarlo): intervalo 30s, timeout 3s, start_period 5s, retries 3. Si wget no está, resolver explícitamente en el build. El estado unhealthy por sí solo no reinicia un contenedor; restart cubre salida del proceso, no fallos HTTP.
- Sin secretos de runtime. CHROMIUM_PATH es solo del runner de pruebas (APP_README.md:64), no pasar al servicio. No pasar HOME/PATH ni entorno general del host.
- Operación: `docker compose up -d`, `docker compose ps`, `docker compose logs --tail=100 web`, `docker compose stop`, `docker compose start`, `docker compose down`. No crear una unidad systemd para envolver Compose. Docker Engine debe estar operativo y arrancar al boot si se quiere recuperación automática del host; esto no implica dependencia de la unidad systemd del juego.

## 4. Migración, respaldo y reversión

La implementación debe documentar pasos ejecutables con directorio de backup nuevo, comprobaciones y comandos que aborten ante fallo. Esta fase de diseño NO hace el corte.

1. Antes de cambiar nada, registrar enabled/active de la unidad con systemctl --user is-enabled/is-active y guardar la unidad y sus drop-ins si aparecieron. Copiar a backup fuera del docroot el directorio `/home/fer/projects/arrecifes-de-memoria-public` completo, más Dockerfile/Compose/nginx.conf/guía y checksum de los cinco archivos. Configuración local solo si no contiene secretos; cualquier secreto futuro exige backup protegido, nunca logs. No copiar indiscriminadamente el home.
2. Reconfirmar igualdad entre fuentes y archivos servidos. Si difieren, detener la migración hasta decidir cuál versión conservar; no sobrescribir automáticamente. No hay export de DB ni migración de puntajes. Las partidas abiertas viven en el navegador y se pierden al recargar, como ya ocurre actualmente.
3. Construir antes de interrumpir el servidor. Smoke test paralelo bajo proyecto `arrecifes-de-memoria-smoke`, BIND_IP=127.0.0.1 y HTTP_PORT=18090, verificando primero disponibilidad. Verificar todos los criterios de la sección 5. Cerrar únicamente ese proyecto de prueba.
4. Para el corte: configurar IP/puerto LAN, ejecutar `systemctl --user disable --now arrecifes-de-memoria.service`, verificar inactiva y puerto libre. Conservar el archivo de unidad y el directorio antiguo. Ejecutar `docker compose up -d`, esperar healthy y probar HTTP y navegador en la URL LAN existente. No detener otros servicios ni cambiar firewall/router de forma global. HTTP LAN no aporta autenticación ni cifrado: no publicar en Internet.
5. Si falla el corte: `docker compose down` del proyecto definitivo; confirmar que liberó 8090; restaurar el estado anterior de systemd (en este host era enabled/active: `systemctl --user enable --now arrecifes-de-memoria.service`). Si se restauró el archivo de unidad, daemon-reload antes de iniciar. Verificar el proceso y HTTP LAN. Como no se tocó el docroot anterior, no es necesario restaurar archivos salvo corrupción comprobada.
6. Para futuras actualizaciones Compose: guardar/taggear ID de la imagen funcional anterior con una etiqueta de release inmutable y exportarla si se requiere backup externo; guardar configuración correspondiente antes del rebuild. Documentar rollback con la imagen/configuración anteriores y arranque `--no-build`, sin reconstruir desde archivos nuevos. No ejecutar prune ni eliminar imágenes de rollback.

RPO: contenido estático de la última versión respaldada, sin estado de usuario de servidor. RTO: no medido; objetivo operativo de corte breve después de build y smoke test, sin prometer un tiempo no probado. Verificar recuperación automática del contenedor sin reiniciar el host compartido; ensayo de reboot real requiere ventana autorizada.

## 5. Aceptación para implementación y QA

- docker compose config válido con defaults, y con configuración LAN explícita; no requiere .env para uso local. Revisar que no haya puertos UDP ni mounts de fuentes/secretos.
- docker compose up -d construye/arranca la imagen faltante; proceso no root, rootfs read-only y healthy. No llama a systemctl ni Python/npm para servir. Registrar ID/digest y arquitectura efectiva.
- HTTP 200 para / y los cinco archivos; .mjs con MIME JavaScript. /package.json, /.env, /node_modules/, /arrecifes_source.json, /nginx.conf y rutas inexistentes devuelven 404, sin listado de directorios.
- Hash de JSON descargado igual al dataset original. Navegador real carga ES modules, mapa, niveles y respuestas; sin dependencias de red externas para jugar. Probar contra Compose, no únicamente contra el servidor efímero de tests/browser.test.mjs.
- Ejecutar npm test y npm run test:functional como regresión, manteniendo claras las pruebas que usan servidor propio y las que ejercitan Compose.
- Verificar stop/start, recreación y logs, sin pérdida de contenido; no hay volúmenes que recuperar. Ensayar rollback en puerto de prueba antes del corte; si no se ejecuta rollback real dejar explícita esa limitación.
- Para concluir la migración: unidad anterior inactive/disabled, contenedor sirviendo en 192.168.0.105:8090, backup utilizable y sin doble listener. Si faltan permisos para detener la unidad, entregar imagen verificada en puerto alternativo y reportar bloqueo de corte, no afirmar migración completa.

## 6. Evidencia de esta tarea y límites

Ejecutado: inspección de unidad/estado/drop-ins, archivos publicados, listeners, arquitectura, versiones Docker/Compose y acceso al daemon; SHA-256 de fuente/publicación coincidentes; npm test con 5 pruebas aprobadas y 0 fallos. No se ejecutó build, Compose ni prueba HTTP del contenedor porque corresponden a implementación.

Una solicitud curl al servicio LAN fue bloqueada por la política de ejecución del entorno antes de realizarse. No se intentó eludirla: el estado actual se acredita mediante systemctl/ss y los archivos en disco, no por respuesta HTTP. Implementación/QA deben obtener evidencia HTTP autorizada o reportar ese bloqueo. La inspección no cambió servicios, puertos ni archivos existentes; únicamente se agregó esta especificación.

## 7. Decisión posterior del usuario: sin Nginx

La entrega de t_d76dc2c6 va sin Nginx ni proxy. Esta corrección sustituye la decisión A y las instrucciones de la sección 3 específicas de Nginx. La prohibición histórica de Git de la sección 1 ya fue sustituida por la autorización recogida en AGENTS.md. No cambian los demás requisitos técnicos ni el límite de autorización operativa.

- Una sola imagen sobre Python Alpine oficial, con tag versionado y digest multi-arquitectura verificado. Usar únicamente biblioteca estándar; no instalar dependencias Python. La aplicación sigue siendo estática y no cambia su lógica.
- Sustituir `nginx.conf` por `serve_static.py`. Copiar explícitamente los mismos cinco archivos como único contenido del docroot, y mantener el lanzador fuera de él. Servir solo `/` y las cinco rutas permitidas, con MIME explícito, `no-cache`, sin listado, sin fallback y con 404 real. No usar `python -m http.server` sobre un directorio completo.
- Ejecutar directamente como usuario no root en 8080. Escribir logs en los flujos del contenedor, sin PID ni temporales en el sistema de archivos raíz. Conservar el tmpfs de 16 MiB, el healthcheck interno HTTP, el reinicio, los límites de logs y el resto de las restricciones Compose.
- En las secciones 4–5, el archivo del servidor que se respalda es `serve_static.py`; comprobar el proceso Python del contenedor en lugar de Nginx y demostrar que el arranque no depende del Python del host ni de systemd. Esta variante se limita a uso local o LAN confiable, no a Internet público. El corte real sigue fuera del alcance de implementación.

## 8. Compose autónomo con rankings

El cambio `enable-rankings-in-compose` sustituye el contrato de la imagen y red de las secciones anteriores. Una imagen Node sirve los ocho activos públicos y `/api/v1/` en `http://127.0.0.1:8090` por defecto. Compose usa la red del host Linux con escucha fija en loopback. El puerto se puede elegir con `HTTP_PORT`. SQLite, WAL y snapshots privados comparten un volumen local. El modo HTTPS detrás de un proxy se configura por separado. El servidor Python sigue disponible para práctica estática independiente. El ensayo usa un proyecto y un puerto alternativos y el reemplazo del servicio activo queda para una ventana autorizada.
