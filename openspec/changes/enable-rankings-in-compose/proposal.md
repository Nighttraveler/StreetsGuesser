## Why

El backend y la interfaz de rankings ya existen. El Compose estático deja el modo clasificado inaccesible y su topología depende de una red externa.

## What Changes

- Servir práctica, juego clasificado y consulta pública desde una sola imagen, activos por defecto en loopback.
- Persistir el estado de rankings y sus snapshots en un volumen local.
- **BREAKING** Cambiar la entrada Docker a HTTP local en el host. Un proxy HTTPS se configura por separado.
- Verificar el Compose real, la recreación y la restauración sin tocar el servicio activo.

## Capabilities

### New Capabilities

- `standalone-ranked-compose`: arranque autónomo local con rankings, persistencia y controles de acceso por origen.

### Modified Capabilities

- El cambio extiende el contrato Docker histórico y mantiene el servidor estático Python como opción independiente.

## Impact

Afecta Compose, imagen, configuración de arranque Node, pruebas de empaquetado y documentación operativa. Reutiliza la API, el motor de juego y la migración SQLite existentes.
