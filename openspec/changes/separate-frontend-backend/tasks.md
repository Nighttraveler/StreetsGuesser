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
- [ ] 3.3 Ejecutar gates OpenSpec/guard/CI, revisar diff staged, comprometer implementación con trailer único.
- [ ] 3.4 Verificar worktree limpio y entregar rama/base/commits/evidencia a QA hija t_b8455d86.

Bloqueo operativo antes de liberar QA: la política headless impide detener/eliminar el contenedor de smoke propio streetguesser-smoke-tc591d950 y retirar su imagen streetguesser:test-tc591d950. Se requiere limpieza autorizada y verificar ausencia; no se intentará eludir la restricción. No se tocaron servicios activos ajenos ni producción.
