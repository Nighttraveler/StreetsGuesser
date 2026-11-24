# Contrato de rutas — t_2d0104cf

Ruta definitiva del juego: `/play.html`. Para el CTA Jugar del landing usar `href="./play.html"` (conserva despliegues bajo subdirectorio). No importar app.mjs ni rankings-ui.mjs desde la portada.

- `/` y `/index.html`: documento de portada independiente, sin mapa, formulario, scripts, fetch GIS ni peticiones API. En esta fase incluye solo presentación mínima y enlace; el diseño dashboard corresponde a t_05dbedf9.
- `/play.html`: interfaz completa existente, con catálogo de ciudades, práctica, controles de mapa y clasificado si el servidor lo soporta. Incluye enlace Volver a la portada a `./index.html`.
- Navegación de documento completo, sin router ni fallback SPA. Entrada directa y recarga no requieren navegar primero por la portada. Recargar reinicia práctica local como antes; no se agrega persistencia.
- Se conservan los imports y fetch relativos raíz: no se movió lógica ni GIS.

Publicación estática mínima: index.html, play.html, styles.css, app.mjs, game.mjs, arrecifes_calles.json, juntos. Esta lista de seis sustituye la lista histórica de cinco de APP_README.md. No servir todo el checkout. Docker/serve_static.py conservan allowlist y práctica sin API; rankings-ui.mjs no está en esta imagen y su ausencia mantiene el fallback existente. Node ranked-game/http.mjs expone además los módulos/API de rankings como antes y agrega /play.html a su allowlist de desarrollo. No se actualizó producción ni systemd.

Prueba local de práctica desde el worktree:

    python3 -B -c 'from pathlib import Path; from serve_static import StaticServer; StaticServer(("127.0.0.1", 18094), Path.cwd()).serve_forever()'

Abrir http://127.0.0.1:18094/ y activar Jugar; abrir directamente http://127.0.0.1:18094/play.html, recargar, responder y volver a portada. Finalizar con Ctrl+C. Para clasificado usar composición documentada en RANKINGS_BACKEND.md, visitando /play.html en su mismo origen.

Validaciones reproducibles:

    npm test
    npm run test:functional
    node --experimental-sqlite --test --test-concurrency=1 tests/city-home-browser.test.mjs tests/static-practice-browser.test.mjs tests/rankings-browser.test.mjs tests/rankings-integration.test.mjs tests/rankings-client.test.mjs
    python3 -m unittest discover -s tests -p test_serve_static.py -v


El runner histórico `tests/compose-smoke.sh` comprueba un modelo Compose de bridge propia que ya no coincide con compose.yaml heredado (proxy externo y Traefik). En esta tarjeta se detuvo en la validación previa, sin crear recursos Compose. No ejecutar ese runner esperando verde hasta conciliar ese contrato en una tarea operativa. No se modificó compose.yaml para ocultar la diferencia.

Alternativa de verificación ejecutada: build Docker del candidato, contenedor temporal sin etiquetas Traefik, con usuario no root, rootfs read-only, cap-drop ALL y puerto exclusivo loopback 18094. `COMPOSE_SMOKE_ORIGIN=http://127.0.0.1:18094 node --test tests/compose.test.mjs` ejercita 10 pruebas HTTP/Chromium contra esa imagen real, no certifica configuración Compose ni rollback. Evidencia de ejecución y hashes en GAME_ROUTE_TEST_RESULTS.md. No se certifican Safari/iOS ni teléfonos físicos.
