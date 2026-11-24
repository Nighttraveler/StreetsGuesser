## 1. Especificación
- [x] Inspeccionar SVG, mouse, estilos y grafo QA; validar alcance antes de código.
- [x] Validar y comprometer OpenSpec antes de rutas protegidas (c3c5e7c).

## 2. Implementación
- [x] Añadir regresión táctil y reproducir RED con Chromium emulado (cámara inmóvil).
- [x] Implementar un dedo con captura y cancelación local y preservar pinch/scroll exterior.
- [x] Documentar vista, pasos y límites; añadir unitario incremental en tests/game.test.mjs.

## 3. Verificación y handoff
- [x] Ejecutar npm test (34/34), suite navegador (15/15), cobertura game.mjs (100% líneas/funciones, 98.33% ramas), sintaxis, gates OpenSpec y diff check.
- [ ] Inspeccionar diff staged y crear commit con trailer único; verificar worktree limpio y entregar hashes/base a QA hija.
