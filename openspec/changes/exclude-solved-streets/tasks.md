## 1. Especificación previa
- [x] Inspeccionar baseline, grafo, reglas y consumidores.
- [x] Validar OpenSpec antes de editar rutas protegidas (commit previo 46c37a6).

## 2. Implementación
- [x] Añadir pruebas unitarias y funcionales y comprobar fallo previo.
- [x] Implementar identidad, estado inmutable, progreso y exclusión.
- [x] Conectar controlador, preservar progreso entre niveles y detener agotados.
- [x] Documentar contrato para la siguiente tarjeta UI.

## 3. Verificación y entrega
- [x] Ejecutar unitarias, Chromium, sintaxis y gates OpenSpec/guard/diff.
- [x] Preparar entrega reproducible a la cadena UI/QA con commit protegido y sin integrar main (hash definitivo y limpieza registrados en Kanban tras commit).

## Evidencia de ejecución

- Antes de implementación: npm test falla por export getProgress inexistente; Chromium conserva 4 regresiones verdes y falla el nuevo caso por repetición de calle acertada.
- npm test: 9/9, incluyendo 0/15 a 15/15 y agotamiento de los tres niveles reales (15/13/145).
- npm run test:functional: 6/6 con Chromium local, incluyendo error/salto, envío doble, cambio intermedio y regreso a fácil completado, IDs inválidos/duplicados, carga recuperable, escritorio/móvil y zoom.
- node --test --experimental-test-coverage tests/game.test.mjs: game.mjs 100% líneas, 97.96% ramas y 100% funciones, sin reducir umbrales.
- uv run --offline test_gis.py: 11/11.
- node --check app.mjs y game.mjs: correctos.
- make openspec-validate CHANGE=exclude-solved-streets: válido antes de implementar y al verificar.
- openspec validate --all --strict --no-interactive: 3/3 cambios válidos.
- make openspec-guard-test: 7/7; git diff --check: limpio; make install-hooks: instalado en este worktree.
- SHA-256 GIS intacto: ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e.
- No aplica build de frontend (estáticos sin build) ni Docker (sin cambios de empaquetado); no hay migraciones.
- Revisión independiente e integración pendientes en la cadena t_89aabed0 → t_d8830d6a → t_9c38b911; completar esta fase de implementación sólo libera las dependencias.
