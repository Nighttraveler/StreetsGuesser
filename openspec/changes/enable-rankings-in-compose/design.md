## Context

La API Node existente ya puede servir los ocho activos con su allowlist y usar HTTP de desarrollo para un origen loopback. La versión Docker actual usa Python y ocupa el puerto 8090 del host. Docker Engine 26 permite acceso desde la red local a ciertos puertos publicados a loopback con NAT.

## Decisions

- Conservar el servicio `web` y usar un proceso Node con `network_mode: host` en Docker Engine sobre Linux. Escuchar únicamente en `127.0.0.1`. `HTTP_PORT` configura puerto y origen local desde un único valor. Usar el puerto alternativo 18090 para el ensayo. Quitar red externa, puertos publicados y etiquetas de proxy.
- Reutilizar el modo HTTP loopback y exigir un peer loopback en la API. La comprobación de Host y la de Origin en POST siguen vigentes. En modo HTTPS, permitir la publicación explícita del frontend en la misma imagen y reutilizar las reglas existentes de proxy confiable y cookie segura.
- Fijar imagen Node 22.22.3 por digest de índice con ARM64. Copiar fuentes explícitas y servir activos desde la allowlist Node. Usar UID no root, rootfs de solo lectura, tmpfs, límites de logs y chequeo del catálogo.
- Mantener estado, WAL y snapshots en un volumen local privado. Respaldar con el comando SQLite existente, archivando los snapshots en la misma operación. Ensayar la restauración en un volumen distinto.
- La aceptación usa Chrome y API/SQLite reales en un proyecto Compose de prueba. El corte operativo requiere una ventana posterior. Conservar imagen y configuración anteriores para volver al servicio estático manteniendo el volumen nuevo.
