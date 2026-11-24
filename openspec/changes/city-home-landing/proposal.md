## Why
La raíz abre directamente el juego de Arrecifes y no muestra las ciudades cargadas en el catálogo existente. La portada debe revelar ese catálogo sin inventar ciudades ni confundir indisponibilidad con ausencia de datos.

## What Changes
- Añadir una portada a / e /index.html, antes del juego, con los nombres exactos de las ciudades del catálogo público actual.
- Reutilizar GET /api/v1/catalog y el cliente y carga de rankings, iniciando la consulta al montar, con carga, vacío, éxito, error y reintento.
- Validar el contrato del catálogo y renderizar nombres como texto, sin HTML interpretado.
- Mantener práctica independiente en el servidor estático de cinco activos; si faltan módulos mostrar indisponibilidad, sin fallback de ciudades hardcodeadas.
- Añadir pruebas unitarias, Chromium móvil/escritorio y comprobación con backend real.

## Capabilities
### New Capabilities
- `city-home-landing`: portada accesible con catálogo existente y estados diferenciados.
### Modified Capabilities
Ninguna; no cambian reglas del juego, API ni permisos.

## Impact
index.html, styles.css, app.mjs, rankings-ui.mjs, ranked-game-client.mjs y pruebas/documentación. Sin nuevas dependencias runtime, migraciones ni cambios Docker/GIS. El catálogo es público y global; este proyecto no implementa estudios ni aislamiento multi-tenant.