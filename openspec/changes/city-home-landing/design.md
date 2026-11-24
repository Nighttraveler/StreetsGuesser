## Context
La raíz y /index.html comparten index.html. Catalog.view() devuelve {cities:[{id,name,difficulties}]} y createRankedClient.catalog() conserva credentials same-origin, cache no-store y timeout. mountRankings ya consulta este recurso bajo acción manual. El servidor Python publica solo cinco activos y no ofrece API ni módulos de rankings.

## Decisions
- Insertar sección Ciudades disponibles al inicio, conservando el juego y las regiones de rankings. No introducir router, navegación ficticia ni selección de práctica multi-ciudad.
- Unificar carga inicial y reintento de portada con carga de rankings. Un único request en vuelo; deshabilitar ambos disparadores y filtros durante carga; limpiar lista/filtros anteriores ante carga o fallo. No crear sesiones ni partidas al visitar la portada.
- Validar estructura completa antes de consumirla, admitiendo cities vacío. Respuesta malformada es error, no lista vacía. Mantener nombres, orden y número de filas; textContent evita ejecución de nombres HTML.
- Lista semántica, región live polite y aria-busy en resultados, estilos existentes y grid adaptable con minmax(min(100%, 240px),1fr); nombres largos envuelven sin truncar.
- Fallo del módulo opcional establece error de portada y deshabilita reintento imposible; práctica sigue arrancando sin solicitudes API en el servidor de cinco activos. Sin ciudad fallback.

## Risks / limits
El servidor estático no tiene catálogo: mostrar indisponibilidad es intencional. La portada no redefine el nombre de la ciudad de práctica ni amplía el registro del backend. No requiere build frontend. Las fixtures de test son explícitas, no runtime.

## Verification
Pruebas unitarias del validador; Chromium con backend real y dos ciudades registradas desde datasets existentes en almacenamiento temporal. Fixtures adicionales para demora, vacío, fallo HTTP/red/formato, recuperación y texto hostil/largo. Regresión de práctica estática y rankings, gates OpenSpec, npm test y diff-check. Capturas móvil/escritorio fuera del repositorio.