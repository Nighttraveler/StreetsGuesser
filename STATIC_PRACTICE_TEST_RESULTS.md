# Corrección de arranque estático — t_04412c35

## Candidato y alcance

Worktree: `/home/fer/projects/StreetGuesser/.worktrees/t_04412c35`.
Rama: `wt/rankings-static-practice-fix`.
Base main: `ee398b422fa639b4c3e48593c38b144a4e2b9d6b`.
Candidato combinado anterior preservado: `8dc5e789bc0aa9be0663af96341b5531060ad84f`.
Especificación previa: `96c2bde` (decouple-static-practice-rankings), validada y comprometida antes de escribir la prueba y antes de editar app.mjs. El contrato add-city-difficulty-rankings y commits anteriores permanecen intactos.

Solo app.mjs cambia en producción: import dinámico opcional y montaje independiente de rankings, rechazo capturado en su panel sin bloquear práctica. Sin modificaciones a Dockerfile, serve_static.py, empaquetado, API, GIS o migraciones. Sin build Docker: no se cambió su configuración; se ejercitó el servidor Python real con copia temporal exacta de sus cinco activos. No implica prueba de contenedor ni despliegue.

## RED → GREEN real

`node --test tests/static-practice-browser.test.mjs` antes de modificar app.mjs:
FAIL 0/1, timeout 5000ms esperando `#answer:enabled` (línea47). El import estático faltante impide evaluar el módulo de práctica.

Mismo comando después de la corrección:
PASS 1/1, 0 skips. Chromium renderiza mapa SVG, input habilitado, respuesta correcta → progreso1/15 y10 puntos, siguiente ronda habilitada, sin excepciones JS ni peticiones API/externas. Los módulos de rankings y API siguen devolviendo404, igual que rutas privadas/desconocidas. El fallo opcional se comunica en catalog-status y su botón queda deshabilitado.

La prueba importa StaticServer de serve_static.py real, con loopback/puerto efímero y directorio temporal con solo los activos declarados en COPY de Dockerfile. No usa harness HTTP Node ni expone archivos extra.

## Regresiones ejecutadas

Entorno: Node v22.22.3, SQLite nativo3.51.3, Chromium local por Playwright. SQLite emite su advertencia experimental esperada; no se suprimió.

- `npm test`: PASS31/31, 0 skips (juego, runtime y backend).
- `npm run test:functional`: primera corrida10/12, dos fallos en pruebas preexistentes de arrastre/cámara (`tests/browser.test.mjs:101` coordenada y `:201` animación). Repetición completa sin editar código ni tests: PASS12/12, 0 skips. Son fallos intermitentes en pruebas intactas, separados de la regresión estática. Los handoffs previos ya advertían intermitencias de arrastre/foco; no se afirma haber ejecutado esta corrida contra el árbol anterior.
- `node --test tests/rankings-client.test.mjs tests/rankings-browser.test.mjs`: PASS11/11 (4 cliente +7 Chromium contractuales), 0 skips.
- `env -u RANKINGS_BACKEND_ROOT node --experimental-sqlite --test tests/rankings-integration.test.mjs`: PASS1/1, 0 skips. API/http.mjs y SQLite de este worktree, sin backend prestado: dos propietarios completan15/15, marcas145/150, cookie HttpOnly, conflicto nombre canónico, orden y filtro dificultad.
- `python3 -B -m unittest discover -s tests -p 'test_*.py' -v`: PASS22/22, incluidos HTTP real4, guard7 y CI11.
- `make openspec-validate CHANGE=decouple-static-practice-rankings`: PASS previo a implementación y en verificación.
- `make openspec-validate CHANGE=add-city-difficulty-rankings`: PASS.
- `openspec validate --all --strict --no-interactive`: PASS10/10.
- `make openspec-guard-test`: PASS7/7.
- `git diff --check`: PASS.
- `make install-hooks`: PASS, hook local versionado instalado antes del commit documental.

Los hashes finales y la validación CI del rango se registran en el resultado estructurado y comentario a QA después de crear el commit. No hay aprobación independiente aún; este cierre es únicamente hito de implementación que libera t_ad651c3c, no cierre global ni integración a main.
