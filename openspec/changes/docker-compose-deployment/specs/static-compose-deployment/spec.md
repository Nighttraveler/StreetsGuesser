## ADDED Requirements

### Requirement: Reproducible static image
La imagen SHALL usar la base oficial nginx stable Alpine fijada mediante versión concreta y digest de índice multi-arquitectura verificado en el registry y documentado. El build local SHALL ser nativo, permitir exclusivamente Dockerfile, nginx.conf y los cinco publicables en su contexto, limpiar páginas de ejemplo y copiar explícitamente solo index.html, styles.css, game.mjs, app.mjs y arrecifes_calles.json al docroot. No SHALL modificar lógica ni GIS, ni requerir otros runtimes de aplicación, servicios auxiliares o un registry propio.

#### Scenario: Construcción nativa
- **WHEN** Compose arranca desde un checkout preparado sin su imagen local
- **THEN** construye desde el contexto del checkout y sirve exclusivamente los cinco originales en una imagen con arquitectura efectiva verificable, sin descargar la etiqueta privada

### Requirement: Restricciones de ejecución Compose
El proyecto SHALL llamarse por defecto arrecifes-de-memoria y ejecutar solo web, en una red bridge propia, con una única publicación TCP configurable (127.0.0.1:8090 por defecto hacia 8080 interno). SHALL usar el proceso nginx directo como usuario no root, rootfs read-only, tmpfs /tmp de 16 MiB para PID y temporales, cap_drop ALL, no-new-privileges, restart unless-stopped y logs stdout/stderr json-file 10m/3. No SHALL usar contenedor privilegiado, socket Docker, nombre fijo de contenedor, host networking, proxy obligatorio, bind mounts, persistencia ni secretos o entorno del host. .env.example SHALL documentar la interpolación, sin env_file de runtime.

#### Scenario: Proceso sano bajo restricciones
- **WHEN** se inicia el contenedor endurecido
- **THEN** wget comprueba HTTP / en 127.0.0.1:8080 cada 30 s, con timeout 3 s, start_period 5 s y 3 reintentos, y la raíz permanece de solo lectura

### Requirement: Frontera HTTP e integridad
Nginx SHALL servir el índice y los cinco estáticos con tipos HTML text/html, CSS text/css, módulos application/javascript y JSON application/json, más Cache-Control no-cache. SHALL usar try_files con 404 real, sin listados ni fallback; los archivos privados no SHALL exponerse. El dataset y la atribución OSM SHALL permanecer intactos.

#### Scenario: Cliente HTTP y navegador real
- **WHEN** se consulta Compose desde el host y se abre el juego con Chromium
- **THEN** los archivos permitidos y sus MIME coinciden, las rutas privadas e inexistentes dan 404, el SHA-256 del dataset coincide y funcionan mapa, niveles y respuestas sin recursos externos

### Requirement: Operación y reversión sin estado
La guía SHALL documentar arranque, actualización, estado, logs, stop/start/down, restricciones del healthcheck, recuperación con Docker al boot, backups verificados fuera del docroot, distribución nativa offline save/load y rollback por imagen/configuración previa sin rebuild. SHALL documentar corte autorizado con comprobaciones abortables sobre fuentes, IP, puerto, unidad y estado anterior, y reversión a systemd sin modificar el docroot. No se SHALL ejecutar el corte real en implementación.

#### Scenario: Ensayo aislado
- **WHEN** se verifica la entrega en un proyecto de prueba, en un puerto loopback libre
- **THEN** pasan config de loopback y LAN, build, healthcheck, permisos, HTTP, navegador, stop/start, recreación, logs y rollback por imagen; no se modifica el servicio heredado y se distingue este ensayo de la migración real
