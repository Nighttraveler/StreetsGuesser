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
- [ ] Resolver limpieza operativa del contenedor temporal (política headless deniega docker stop).
- [x] Registrar resultados, revisar diff y commitear con trailer (6087c94).
- [x] Comprobar árbol limpio tras el commit de implementación.
- [ ] Liberar la cadena landing/QA después de resolver el bloqueo operativo; sin integrar.
