## 1. Especificación previa
- [x] Inspeccionar montaje, servidores, pruebas y grafo de revisión.
- [x] Definir /play.html, aislamiento y contrato de seis activos.
- [x] Validar y commitear OpenSpec antes de código (3ec4115).

## 2. Implementación
- [x] Añadir pruebas de aislamiento, entrada directa, recarga y navegación; comprobar RED.
- [x] Separar documentos y actualizar allowlists y Docker sin cambiar lógica.
- [x] Adaptar pruebas existentes y documentación de publicación/ruta.

## 3. Verificación y entrega
- [x] Ejecutar gates, unitarias, HTTP, navegador y build/smoke Docker alternativo (10/10); runner Compose histórico bloqueado por contrato heredado, ver GAME_ROUTE_TEST_RESULTS.md.
- [x] Resolver limpieza operativa del contenedor e imagen temporales tras autorización del usuario; ausencia verificada por nombre, ID y etiqueta, ver GAME_ROUTE_TEST_RESULTS.md.
- [x] Registrar resultados, revisar diff y commitear con trailer (6087c94).
- [x] Comprobar árbol limpio tras el commit de implementación.

## Seguimiento externo a la implementación
La limpieza operativa está resuelta. Esta entrega requiere nueva revisión de QA sobre t_2d0104cf; la aprobación e integración a main corresponden a QA/integrador autorizado y no se declaran realizadas. Tras esa revisión y el cierre de la tarjeta, Kanban libera la fase landing t_05dbedf9; su QA posterior corresponde a t_2656ea05. Esa cadena no es una tarea pendiente de implementación de este cambio.

Se mantiene la limitación del runner Compose heredado: el smoke Docker alternativo 10/10 no certifica Compose completo ni rollback, según GAME_ROUTE_TEST_RESULTS.md.
