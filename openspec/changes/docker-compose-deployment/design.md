## Context
El juego no tiene build de frontend, dependencias externas de ejecución ni estado persistente. El servicio legado publica en 192.168.0.105:8090; desarrollar únicamente en el worktree asignado y probar con proyecto y puerto loopback separados.

## Decisions
- La variante oficial `stable-alpine` se resuelve al tag versionado con el mismo digest de índice del registry. Se fija ese tag y digest; los builds seleccionan arquitectura nativa sin forzar amd64.
- Dockerfile y .dockerignore enumeran los archivos de forma independiente. Limpiar el docroot base; el servidor solo admite el índice y cinco rutas estáticas exactas. Nginx se inicia directamente como nginx, con PID y temporales en /tmp y salida a los flujos del contenedor.
- Compose incluye `build` e `image`, con `pull_policy: never`. Usar etiqueta local por defecto y permitir una etiqueta exclusiva en el ensayo para no sobreescribir una imagen activa. La reversión restaura una etiqueta salvada y la configuración correspondiente; `--no-build` evita mezclar versiones. La prueba arranca una segunda imagen distinta construida con un marcador de prueba que no se publica; después verifica la vuelta al ID original mediante save/load.
- El smoke comprueba configuración y permisos efectivos, frontera HTTP, integridad y flujos en Chromium real, ciclo de vida, transferencia y reversión. La regresión funcional existente conserva su servidor efímero propio. QA independiente se hace en la tarjeta hija existente.

## Risks
El primer build requiere acceso al registry si falta la base; los tar son de la arquitectura efectiva. Una publicación LAN carece de cifrado/autenticación. La colisión de puertos, la coexistencia del listener legado y la restauración de su unidad se tratan en la guía; el corte y reinicio físico requieren autorización aparte. En Docker anterior a 28, la publicación loopback tiene una salvedad documentada de accesibilidad desde la misma red de capa 2.
