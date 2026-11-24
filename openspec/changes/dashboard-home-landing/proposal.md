## Why
La portada mínima ya está separada del juego pero no comunica su propuesta con la densidad y jerarquía de dashboard solicitadas en t_05dbedf9.

## What Changes
- Portada editorial compacta con panel de bienvenida, ficha del juego, pasos de inicio y modos.
- Estética propia inspirada en estructura de Sentry, Kraken, Cohere y ClickHouse, sin copiar identidad ni inventar métricas.
- Mantener Jugar como enlace nativo relativo a play.html; cero runtime del juego, API o GIS en home.
- Pruebas de estructura, escritorio/móvil, zoom, teclado y navegación completa.

## Capabilities
### New Capabilities
- `dashboard-home-landing`: presentación accesible e independiente del juego.

## Impact
Solo index.html, pruebas de rutas y navegador, y documentación de resultados. CSS encapsulado en el documento para no afectar el juego ni ampliar publicación. Sin dependencias, migraciones, cambios API o despliegue.
