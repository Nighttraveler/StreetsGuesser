## 1. Especificación previa

- [x] 1.1 Inspeccionar baseline, mapa aprobado, reglas y contratos; publicar plan de archivos.
- [ ] 1.2 Validar artefactos y crear commit documental antes de editar protegidos.

## 2. Reorganización

- [ ] 2.1 Agregar regresión explícita del layout/contratos y observar fallo previo.
- [ ] 2.2 Mover frontend y backend, ajustar imports/scripts/GIS sin cambiar datos, reglas ni SQL.
- [ ] 2.3 Ajustar Dockerfile y allowlist; actualizar fixtures y rutas de suites sin cambiar expectativas de negocio.
- [ ] 2.4 Actualizar documentación vigente y comandos de publicación/respaldo.

## 3. Verificación y entrega

- [ ] 3.1 Ejecutar suites Node, Chromium, SQLite real sin override y con override, Python/GIS y cobertura.
- [ ] 3.2 Comparar hashes y bytes baseline; ejecutar build Docker y smoke aislado sin despliegue.
- [ ] 3.3 Ejecutar gates OpenSpec/guard/CI, revisar diff staged, comprometer implementación con trailer único.
- [ ] 3.4 Verificar worktree limpio y entregar rama/base/commits/evidencia a QA hija t_b8455d86.
