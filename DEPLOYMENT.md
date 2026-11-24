# Despliegue de Arrecifes · De memoria

El único servicio, `web`, entrega seis activos: `index.html`, `play.html`, `styles.css`, `game.mjs`, `app.mjs` y `arrecifes_calles.json`. `/` y `/index.html` son portada sin runtime del juego; `/play.html` es la URL del juego, también al abrir o recargar directamente. Ver GAME_ROUTE.md. Conserva la atribución de OpenStreetMap. Usa la biblioteca estándar de Python dentro de la imagen; no requiere Nginx, proxy, Node, Python en el host, base de datos, volúmenes, secretos ni la unidad systemd del juego. No hay partidas, sesiones ni marcadores persistidos en el servidor.

## Arranque y operación

Ubicaciones vigentes (separate-frontend-backend): los seis activos fuente están en frontend/ y el lanzador en backend/serve_static.py. Docker los copia por basename al mismo docroot /srv/arrecifes/public/ y mantiene /srv/arrecifes/serve_static.py como entrypoint. No hay build frontend ni cambio del mecanismo de despliegue.

Advertencia sobre configuración heredada: compose.yaml actualmente usa BIND_IP default 0.0.0.0 y red externa proxy con etiquetas Traefik. Eso contradice las descripciones históricas de loopback/bridge propia de esta guía. Esta mudanza NO modifica Compose ni certifica esa topología; revisar `docker compose --env-file /dev/null config` y no ejecutar operaciones de producción sin ventana autorizada. El runner tests/compose-smoke.sh sigue esperando el modelo antiguo y no se usa para certificar este candidato. Ver REPOSITORY_LAYOUT.md para build/smoke aislados sin proxy ni etiquetas productivas.

Requisitos: Docker Engine operativo, complemento Docker Compose v2, acceso al daemon, puerto TCP libre y capacidad para una red bridge propia. Verificado en Linux arm64 con Engine 26.1.5 y Compose 2.26.1; no se ha verificado amd64. Usar un directorio de entrega aprobado, no el docroot del servicio legado. El primer build necesita acceso al registry de la base si no está disponible localmente. La base fijada en `Dockerfile` es:

```text
docker.io/library/python:3.13.18-alpine3.24@sha256:9ef1a599f863231c3d91e941389bfdc4a2d6070557243d54df1a4e57015b960e
```

El digest es del índice multi-arquitectura. Se verificó con `docker buildx imagetools inspect` que `python:3.13-alpine` y `python:3.13.18-alpine3.24` apuntaban al mismo índice el 20 de noviembre de 2026 y que incluía `linux/arm64/v8`. No forzar plataforma ni sustituir el digest sin verificar el tag versionado y repetir las pruebas.

```bash
docker compose config
docker compose up -d
docker compose ps
docker compose logs --tail=100 web
docker compose stop
docker compose start
docker compose down
```

La configuración local por defecto es `http://127.0.0.1:8090/`, con TCP 8080 dentro del contenedor. No hace falta `.env`. Para cambiar el bind, copiar `.env.example` a un archivo local nuevo y pasar `--env-file` o usar `.env` solo si aún no existe; `BIND_IP`, `HTTP_PORT` y la etiqueta opcional `ARRECIFES_IMAGE` son interpolación, no entorno del contenedor. El proyecto por defecto es `arrecifes-de-memoria`. Si falta `arrecifes-de-memoria:local`, `up` la construye; no intenta descargar esa etiqueta. Para actualizar contenido o el lanzador, respaldar primero y usar `docker compose up -d --build --wait --wait-timeout 90`.

La comprobación de salud usa `wget` a `127.0.0.1:8080/`: intervalo 30 s, timeout 3 s, período inicial 5 s, 3 reintentos. `unhealthy` no reinicia el contenedor; consultar `ps`, logs y `.State.Health` con `docker inspect`. `restart: unless-stopped` cubre la salida del proceso y permite recuperar el contenedor si Docker arranca con el host y no se paró manualmente. No envolver Compose en otra unidad systemd. Python corre directamente como usuario `arrecifes`, sin capacidades. La raíz es de solo lectura, hay un tmpfs de 16 MiB en `/tmp` y el lanzador no escribe PID ni temporales. Docker rota la salida estándar y de error (`json-file`, 10 MiB por archivo, 3 archivos).

Este servidor pequeño usa `http.server` con lista de rutas explícita y es solo para uso local o LAN confiable, no para un servicio público de producción. HTTP no cifra ni autentica: no publicar en Internet, ni cambiar a `0.0.0.0` por comodidad. Docker documenta que en Engine anterior a 28.0.0 un host en el mismo segmento de capa 2 puede alcanzar puertos ligados a loopback; no usar ese bind como única barrera en redes no confiables (Docker Docs, *Port publishing and mapping*).

## Ensayo aislado, sin detener el legado

Desde el checkout candidato, con Node 22+, Chromium, `curl`, Python 3 y `iproute2`; `CHROMIUM_PATH` es solo del runner de pruebas. El guion comprueba que esté libre el puerto y que no exista el proyecto `arrecifes-de-memoria-smoke`. Usa únicamente loopback y etiquetas propias, limpia el proyecto al finalizar y no lee `.env` ni llama a systemd.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run test:functional                  # servidor HTTP efímero de la regresión
python3 -m unittest discover -s tests -p test_serve_static.py -v
bash tests/compose-smoke.sh 18090         # navegador y HTTP contra el contenedor real
```

La prueba verifica modelos de Compose por defecto/LAN/ensayo, build automático, healthcheck, restricciones efectivas, seis archivos y MIME, HEAD sin cuerpo, 404 de rutas privadas, SHA-256 del dataset, portada aislada, navegación y recarga del juego en Chromium, stop/start, recuperación automática tras la salida del proceso, recreación, logs y rollback. El rollback usa dos imágenes de IDs distintos (la segunda difiere en una etiqueta de build, no en los datos), restaura la configuración archivada y vuelve a la primera imagen con `load` y `--no-build`.

Si el daemon no tiene un pool IPv4 disponible, no podar redes ni tocar el daemon compartido. Inventariar subredes y rutas del host, incluidas VPN, y elegir una subred privada no solapada. El guion acepta `SMOKE_SUBNET`, comprueba redes Docker y rutas locales y aplica un archivo complementario temporal solo a ese proyecto. Ejemplo **solo si sigue libre**:

```bash
SMOKE_SUBNET=10.254.90.0/29 bash tests/compose-smoke.sh 18090
```

Para un despliegue posterior con ese mismo problema, preparar un `compose.network.yaml` local explícito, validar `docker compose -f compose.yaml -f compose.network.yaml config` y usar ambos `-f` en todas las operaciones. No reutilizar una red de otro proyecto. Guardar también ese archivo con la configuración de la entrega. El candidato no fija ninguna subred como requisito general; el siguiente valor es solamente un ejemplo que se debe volver a verificar contra redes Docker, rutas y VPN:

```yaml
networks:
  default:
    ipam:
      config:
        - subnet: 10.254.90.0/29
```

## Distribución offline y rollback de una actualización Compose

Ejecutar con Bash desde una entrega funcional. Guardar imagen y configuración **antes** de un rebuild. Ejemplo sin archivo complementario: si se usa, añadirlo a todos los comandos `-f` de ese proyecto y copiarlo al respaldo. Los nombres de etiquetas son únicos; no reasignar las etiquetas de entrega a otra imagen. En este ejemplo el `compose.yaml` enlaza el rollback mediante `ARRECIFES_IMAGE`. Exportar únicamente variables públicas conocidas, nunca una copia ciega de `.env`.

```bash
set -euo pipefail
umask 077
mkdir -p "$HOME/backups"
release=$(mktemp -d "$HOME/backups/arrecifes-release.XXXXXXXX")
cid=$(docker compose ps -q web)
test -n "$cid"
test "$(docker inspect -f '{{.State.Health.Status}}' "$cid")" = healthy
id=$(docker inspect -f '{{.Image}}' "$cid")
arch=$(docker image inspect -f '{{.Architecture}}' "$id")
release_id=${id#sha256:}
tag="arrecifes-de-memoria:release-$arch-$release_id"
docker image tag "$id" "$tag"
docker image save -o "$release/image.tar" "$tag"
cp -- Dockerfile compose.yaml .dockerignore .env.example DEPLOYMENT.md "$release/"
mkdir "$release/frontend" "$release/backend"
cp -- frontend/index.html frontend/play.html frontend/styles.css frontend/game.mjs frontend/app.mjs frontend/arrecifes_calles.json "$release/frontend/"
cp -- backend/serve_static.py "$release/backend/"
(cd frontend; sha256sum index.html play.html styles.css game.mjs app.mjs arrecifes_calles.json) > "$release/statics.sha256"
printf '%s\n' "$id" > "$release/image.id"
printf '%s\n' "$arch" > "$release/image.arch"
# Ajustar estos dos valores públicos al enlace comprobado del despliegue anterior.
printf 'BIND_IP=127.0.0.1\nHTTP_PORT=8090\nARRECIFES_IMAGE=%s\n' "$tag" > "$release/release.env"
(cd "$release"; sha256sum -- image.tar image.id image.arch statics.sha256 compose.yaml release.env > SHA256SUMS; sha256sum -c SHA256SUMS)
printf 'Respaldo: %s\n' "$release"
```

Para transferir, copiar el directorio de release completo por un medio de confianza. La suma detecta corrupción, no autentica el origen. Para rollback en el mismo equipo, mantener el **mismo** nombre de proyecto (el ejemplo usa el definitivo); para entrega independiente, elegir un proyecto/puerto libres. Si se cambia la ubicación del Compose, apuntar al archivo guardado como se muestra y seguir operando siempre con los mismos argumentos. La imagen offline no necesita fuentes ni registry, pero sí configuración y daemon de arquitectura compatible:

```bash
# Definir release con la ruta del respaldo verificado, o conservar la de arriba.
set -euo pipefail
(cd "$release"; sha256sum -c SHA256SUMS)
# En Docker el host aarch64 corresponde a una imagen arm64.
docker info --format '{{.OSType}}/{{.Architecture}}'
docker image load -i "$release/image.tar"
rollback=(docker compose -p arrecifes-de-memoria --env-file "$release/release.env" -f "$release/compose.yaml")
unset BIND_IP HTTP_PORT ARRECIFES_IMAGE
"${rollback[@]}" config
"${rollback[@]}" up -d --no-build --wait --wait-timeout 90
cid=$("${rollback[@]}" ps -q web)
test "$(docker inspect -f '{{.Image}}' "$cid")" = "$(<"$release/image.id")"
"${rollback[@]}" port web 8080
"${rollback[@]}" logs --tail=20 web
```

Verificar HTTP, checksum y navegador en el enlace reportado. No ejecutar `prune` ni eliminar la imagen de rollback. Un rebuild desde fuentes nuevas no es rollback.

## Migración desde systemd: solo con autorización y ventana de QA

**No ejecutar el corte como parte de la implementación ni del ensayo paralelo.** Los siguientes bloques están previstos para una persona operadora, desde Bash, en un directorio de entrega aprobado. Confirmar con `systemctl --user cat arrecifes-de-memoria.service` que la unidad corresponde al juego (no copiar entornos con secretos). El juego legado esperado está `enabled`/`active` y sirve desde `/home/fer/projects/arrecifes-de-memoria-public` en `192.168.0.105:8090`. Si el estado, la ruta, la IP o los drop-ins difieren de lo esperado, parar y revisar antes del corte; preparar la restauración según el estado real. No copiar todo el home.

**Respaldo previo, sin interrupción:**

```bash
set -euo pipefail
umask 077
unit=arrecifes-de-memoria.service
legacy=/home/fer/projects/arrecifes-de-memoria-public
files=(index.html play.html styles.css game.mjs app.mjs arrecifes_calles.json)
mkdir -p "$HOME/backups"
backup=$(mktemp -d "$HOME/backups/arrecifes-systemd.XXXXXXXX")
systemctl --user is-enabled "$unit" > "$backup/unit.enabled" || true
systemctl --user is-active "$unit" > "$backup/unit.active" || true
test "$(<"$backup/unit.enabled")" = enabled
test "$(<"$backup/unit.active")" = active
fragment=$(systemctl --user show -p FragmentPath --value "$unit")
test -f "$fragment"
mkdir -p "$backup/unit" "$backup/deploy"
cp -a -- "$fragment" "$backup/unit/"
# Incluye la configuración efectiva en una copia restringida; copiar también cada drop-in si existe.
systemctl --user cat "$unit" > "$backup/unit/effective.txt"
systemctl --user show -p DropInPaths --value "$unit" > "$backup/unit/dropins.txt"
if test -s "$backup/unit/dropins.txt" && test -n "$(<"$backup/unit/dropins.txt")"; then
  printf '%s\n' 'Hay drop-ins: confirmar el contrato y respaldar cada ruta del inventario antes de continuar.' >&2
  exit 1
fi
cp -a -- "$legacy" "$backup/public"
cp -- Dockerfile compose.yaml .dockerignore .env.example DEPLOYMENT.md "$backup/deploy/"
mkdir "$backup/deploy/frontend" "$backup/deploy/backend"
cp -- "${files[@]/#/frontend/}" "$backup/deploy/frontend/"
cp -- backend/serve_static.py "$backup/deploy/backend/"
(cd frontend; sha256sum -- "${files[@]}") > "$backup/statics.sha256"
(cd "$legacy"; sha256sum -c "$backup/statics.sha256")
(cd "$backup/public"; sha256sum -c "$backup/statics.sha256")
printf 'Respaldo verificado: %s\n' "$backup"
```

Si el legado aún tiene cinco activos o bytes de otra versión, la comparación de los seis actuales abortará: no sobrescribirlo automáticamente ni ejecutar el corte sin reconciliación aprobada. Si hay drop-ins, archivar individualmente los archivos listados conservando sus rutas (por ejemplo con `cp --parents` a `"$backup/unit"`) y revisar su contenido y precedencia antes de reanudar. Si difieren los hashes, no sobrescribir ninguna copia: decidir primero qué versión conservar. RPO: la última versión estática respaldada. RTO: no medido. Al recargar, una partida abierta se pierde igual que antes; no hay estados de servidor que exportar.

**Preparar antes de detener systemd:** ejecutar el ensayo anterior completo. Confirmar la IP LAN vigente y la disponibilidad de red para el proyecto definitivo. Definir y preservar configuración explícita, registrar el ID de la imagen y construir mientras sigue activo el servidor legado. Si el host requiere archivo complementario de red, agregar su `-f` al arreglo `deploy` antes de empezar y respaldarlo.

```bash
printf 'BIND_IP=192.168.0.105\nHTTP_PORT=8090\n' > "$backup/deploy/lan.env"
unset BIND_IP HTTP_PORT ARRECIFES_IMAGE
deploy=(docker compose -p arrecifes-de-memoria --env-file "$backup/deploy/lan.env" -f "$PWD/compose.yaml")
ip -o -4 addr show | awk '$4 ~ /^192\.168\.0\.105\// { found = 1 } END { exit !found }'
"${deploy[@]}" config
"${deploy[@]}" build web
docker image inspect -f '{{.Id}} {{.Os}}/{{.Architecture}}' arrecifes-de-memoria:local
```

**Corte autorizado únicamente:** revalidar respaldo, IP e imagen antes del siguiente bloque. Si falla cualquier comprobación después de detener systemd, no tocar otros servicios: ejecutar la reversión indicada abajo.

```bash
(cd "$legacy"; sha256sum -c "$backup/statics.sha256")
systemctl --user disable --now "$unit"
test "$(systemctl --user is-active "$unit" || true)" = inactive
test "$(systemctl --user is-enabled "$unit" || true)" = disabled
listeners=$(ss -Hlt 'sport = :8090'); test -z "$listeners"
"${deploy[@]}" up -d --no-build --wait --wait-timeout 90
"${deploy[@]}" ps
"${deploy[@]}" port web 8080
curl --noproxy '*' -fsS --max-time 5 -o /dev/null http://192.168.0.105:8090/
curl --noproxy '*' -fsS --max-time 5 -o "$backup/served-dataset.json" http://192.168.0.105:8090/arrecifes_calles.json
cmp -- "$backup/public/arrecifes_calles.json" "$backup/served-dataset.json"
```

Confirmar desde un cliente LAN la URL, mapa, niveles y una respuesta. Registrar `inactive`/`disabled`, el único listener previsto (sin doble publicación) y la ubicación utilizable del backup. Conservar unidad y docroot anteriores. No cambiar firewall, router ni otros servicios. Probar reinicio real del host solo en ventana aparte.

**Reversión a systemd**, con los mismos argumentos de `deploy` y el respaldo validado:

```bash
"${deploy[@]}" down
listeners=$(ss -Hlt 'sport = :8090'); test -z "$listeners"
(cd "$legacy"; sha256sum -c "$backup/statics.sha256")
# Solo si se restauraron la unidad o sus drop-ins: systemctl --user daemon-reload
systemctl --user enable --now "$unit"  # para el estado anterior enabled+active comprobado arriba
systemctl --user is-enabled "$unit"
systemctl --user is-active "$unit"
ss -Hlt 'sport = :8090'
curl --noproxy '*' -fsS --max-time 5 -o /dev/null http://192.168.0.105:8090/
```

Si se detecta corrupción, detenerse e identificar la diferencia antes de restaurar archivos desde el respaldo. En una reversión normal no se copian datos al docroot anterior.
