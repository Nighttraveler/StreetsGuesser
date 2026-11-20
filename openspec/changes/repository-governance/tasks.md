## 1. Specification
- [x] Registrar autorización e inventario; verificar hashes contra publicación.
- [x] Especificar el gate antes de escribir scripts y validarlo estrictamente.

## 2. Implementation
- [x] Crear Makefile, gate, hook y pruebas unitarias.
- [x] Documentar política local y ramas; instalar hooks.

## 3. Verification and handoff
- [x] Ejecutar pruebas del gate, OpenSpec estricto, regresión y diff-check: 7 gate, 5 unitarias y 4 funcionales aprobadas. Una primera ejecución falló en limpieza del repositorio temporal de prueba; corregido git rm del fixture y repetida la suite completa con éxito.
- [x] Preparar entrega mediante commit con trailer y worktree aislado; hashes y limpieza se verifican en la salida Git de entrega.
