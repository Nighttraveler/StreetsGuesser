# Despliegue de Arrecifes · De memoria

## Arranque local

Ejecutar estos comandos desde el checkout en Docker Engine sobre Linux.

```sh
docker compose up -d --build --wait
docker compose ps
```

Abrir `http://127.0.0.1:8090` desde el host Docker. La portada, la práctica y el modo clasificado comparten servidor y origen. En la pantalla de juego, cargar el catálogo, elegir dificultad e iniciar una partida clasificada. La publicación de la marca se confirma al terminar.

Cambiar el puerto si está ocupado, por ejemplo con `HTTP_PORT=18090 docker compose up -d --build --wait`. Usar el mismo valor en comandos posteriores o guardarlo en el `.env` local. El servidor escucha directamente en `127.0.0.1` mediante la red del host Linux. Usar esa dirección en el navegador, ya que el nombre y puerto deben coincidir con el origen configurado en el servidor. El contenedor antiguo de este proyecto usa el puerto 8090. Antes de reemplazarlo, reservar una ventana y verificar el candidato en otro puerto.

El servicio `web` ejecuta Node sin privilegios y con el sistema de archivos raíz de solo lectura. Su chequeo de salud consulta el catálogo real. Para diagnosticar fallos de arranque, usar `docker compose logs --tail=100 web`. `docker compose down` conserva el volumen de rankings. El orden `down --volumes` elimina los datos del proyecto.

## Verificación aislada

```sh
npm ci
bash tests/compose-smoke.sh 18090
```

El ensayo requiere Node 22.22 o superior, Chromium (ruta configurable mediante `CHROMIUM_PATH`), Python 3 y herramientas de Docker/Linux. Usa un puerto libre, una etiqueta de imagen y dos proyectos de prueba. Verifica el listener, el juego en Chromium, la publicación, la recreación y la restauración en un volumen separado.

## Respaldo y restauración

El volumen `rankings` contiene la DB SQLite, WAL y sus snapshots. Usar el respaldo en línea de SQLite y archivar los snapshots privados junto con la copia. Ejecutar durante una versión estable del catálogo y guardar el archivo fuera del checkout y de directorios publicados.

```sh
umask 077
backup=$(mktemp -d)
docker compose exec -T web sh -eu -c '
  out=$(mktemp -d)
  trap "rm -rf -- \"$out\"" EXIT
  node --experimental-sqlite backend/ranked-game/backup.mjs "$RANKINGS_DB" "$out/rankings.sqlite" >&2
  cp -R "$RANKINGS_DB.datasets" "$out/rankings.sqlite.datasets"
  tar -C "$out" -cf - rankings.sqlite rankings.sqlite.datasets
' > "$backup/rankings.tar"
tar -tf "$backup/rankings.tar"
```

Para restaurar, usar un proyecto nuevo y la misma imagen. Si se ensaya en paralelo, usar un puerto libre y verificar la sesión con el cliente de prueba. En una recuperación operativa, conservar el mismo origen de los navegadores para que vuelvan a enviar su cookie.

```sh
export HTTP_PORT=18091
docker compose -p arrecifes-restaurado run --rm -T --no-deps --entrypoint sh web -eu -c '
  state=${RANKINGS_DB%/*}
  test -z "$(ls -A "$state")"
  tar -C "$state" -xf -
' < "$backup/rankings.tar" &&
docker compose -p arrecifes-restaurado up -d --no-build --wait
```

Comprobar el catálogo y una marca conocida. Para revertir una actualización, conservar previamente el archivo Compose y una etiqueta inmutable de la imagen anterior. Detener el proyecto nuevo con `docker compose down`, arrancar la configuración anterior con `up -d --no-build` y verificar su listener. Conservar el volumen de rankings durante la reversión, incluso si se vuelve temporalmente a una imagen estática.

## HTTPS administrado por separado

La imagen admite terminación TLS con la configuración del operador.

- `NODE_ENV=production`, `RANKINGS_DEVELOPMENT=0` y `RANKINGS_SERVE_FRONTEND=1` habilitan web y API en el modo de producción.
- `RANKINGS_ORIGIN` recibe el origen HTTPS exacto, incluido el puerto si corresponde y sin barra final. `RANKINGS_HOST` y `RANKINGS_PORT` indican dónde escucha el backend. Restringir el acceso a ese socket al proxy.
- `RANKINGS_TRUSTED_PROXY` recibe la IP exacta del proxy que conecta al backend. Configurar el proxy para preservar `Host`, sobrescribir `X-Forwarded-Proto` con `https` y enviar una sola IP de cliente validada en `X-Forwarded-For`.
- Montar el volumen en `/var/lib/arrecifes` y configurar `RANKINGS_DB=/var/lib/arrecifes/state/rankings.sqlite`. Comprobar externamente el catálogo por HTTPS. La cookie de sesión del modo HTTPS es `Secure` y `HttpOnly`.

El servidor Python independiente sigue disponible para práctica estática. Los procedimientos anteriores operan únicamente sobre el proyecto Compose.
