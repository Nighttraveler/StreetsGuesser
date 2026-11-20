## 1. Especificación
- [x] Traducir COMPOSE_SPEC.md a propuesta, diseño y delta propio; plan publicado en Kanban.
- [x] Validar OpenSpec antes de editar rutas protegidas; este commit contiene solo la especificación.
- [x] Reespecificar el cambio sin Nginx por decisión del usuario, publicar el plan actualizado y validar antes de cambiar el runtime.

## 2. Implementación
- [ ] Verificar digest versionado y crear contexto de lista permitida, imagen estática y lanzador Python.
- [ ] Configurar Compose endurecido, interpolación sin secretos y documentación operativa y de corte/reversión.
- [ ] Incorporar pruebas explícitas de configuración, HTTP, seguridad, navegador, ciclo de vida y rollback aislados.

## 3. Verificación y entrega
- [ ] Ejecutar validadores OpenSpec, guard, regresión npm y navegador, diff-check y smoke real.
- [ ] Instalar hooks, revisar índice, confirmar trailer único por commit protegido y entregar worktree limpio y evidencia a QA sin merge, push ni corte.
