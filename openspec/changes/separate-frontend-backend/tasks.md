## 1. Especificación previa

- [x] 1.1 Inspeccionar baseline, mapa aprobado, reglas y contratos; publicar plan de archivos.
- [x] 1.2 Validar artefactos y crear commit documental antes de editar protegidos (f610429).

## 2. Reorganización

- [x] 2.1 Agregar regresión explícita del layout/contratos y observar fallo previo (0/2 antes, 2/2 después).
- [x] 2.2 Mover frontend y backend, ajustar imports/scripts/GIS sin cambiar datos, reglas ni SQL.
- [x] 2.3 Ajustar Dockerfile y allowlist; actualizar fixtures y rutas de suites sin cambiar expectativas de negocio.
- [x] 2.4 Actualizar documentación vigente y comandos de publicación/respaldo.

## 3. Verificación y entrega

- [x] 3.1 Ejecutar suites Node, Chromium, SQLite real sin override y con override, Python/GIS y cobertura (REPOSITORY_LAYOUT_VERIFICATION.md).
- [x] 3.2 Comparar hashes y bytes baseline; ejecutar build Docker y smoke aislado sin despliegue (10/10; limpieza propia pendiente por permisos).
- [x] 3.3 Ejecutar gates OpenSpec/guard/CI, revisar diff staged, comprometer implementación con trailer único (0e9c75c20d6afbecfc20d762cb58960c90e20bdd; gate CI baseline..HEAD válido).
- [x] 3.4 Preparar entrega comprometida con rama/base/commits/evidencia para QA hija t_b81d0b89 de t_16c3de30; comprobar worktree limpio tras el commit documental.

Pendiente operativo heredado de t_c591d950: la política headless impidió detener/eliminar el contenedor de smoke propio streetguesser-smoke-tc591d950 y retirar su imagen streetguesser:test-tc591d950. Ambos siguen presentes; se requiere limpieza autorizada y verificar ausencia, sin eludir la restricción. La nueva fase t_16c3de30 entrega únicamente implementación a QA hija t_b81d0b89, no cierra la entrega raíz, la limpieza, la integración ni el despliegue. No es necesario repetir ni limpiar Docker para revisar el código en solo lectura. No se tocaron servicios activos ajenos ni producción. Evidencia nueva: REPOSITORY_LAYOUT_RECHECK.md; evidencia histórica: REPOSITORY_LAYOUT_VERIFICATION.md.
