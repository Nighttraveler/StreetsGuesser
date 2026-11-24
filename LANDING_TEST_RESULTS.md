# Dashboard landing — t_05dbedf9

## Alcance y diseño
- Rama: `wt/t_05dbedf9`; base común al iniciar: `aa1169e104a6de3162a6eb37cf6370de2c9469dd`.
- OpenSpec: `dashboard-home-landing`, validado antes de tocar rutas protegidas y comprometido previamente en `2258c12`.
- Skill `popular-web-designs`: leídas referencias Sentry, Kraken, Cohere y ClickHouse. Se tomaron grilla, delimitación de paneles, etiquetas mono y jerarquía, manteniendo identidad azul petróleo/lima propia, sin fuentes remotas, logos ni datos ficticios.
- `index.html`: cinco paneles semánticos, guía de tres pasos, ficha, modos y procedencia. Un único CTA Jugar a `./play.html`. Esquema CSS explícitamente ilustrativo, no mapa real ni partida. Sin scripts, fetch, API o GIS en portada. CSS local al documento: estilos y lógica del juego sin modificaciones; allowlists Docker/Node/Python intactas.
- Teclado: skip link, navegación interna, CTA y atribución con foco visible. Móvil de una columna, escritorio tres columnas. Práctica y disponibilidad de clasificado explicadas sin prometer servidor disponible.

## Pruebas reales
Entorno: Node 22.22.3, Chromium 151.0.7922.173, Linux ARM64. Playwright 1.58.2 instalado mediante `npm ci --ignore-scripts` (0 vulnerabilidades).

1. RED antes de implementación: `node --test tests/game-route.test.mjs`: nueva prueba falla por ausencia de dashboard (2 pasan, 1 falla). `node --experimental-sqlite --test --test-name-pattern='dashboard reflows' tests/city-home-browser.test.mjs`: falla por 0 paneles frente a 5 esperados.
2. GREEN: `npm test`: 37/37 PASS (incluye nueva prueba estructural explícita).
3. `node --experimental-sqlite --test --test-concurrency=1 tests/city-home-browser.test.mjs tests/static-practice-browser.test.mjs tests/rankings-browser.test.mjs tests/rankings-integration.test.mjs tests/rankings-client.test.mjs`: 20/20 PASS. Incluye nueva prueba responsive/teclado: 320, 375, 768 y 1280 CSS px, fuente 100% y 200%, ancho del documento y contenido sin overflow, recorrido real con Tab y foco visible, CTA con altura ≥44px, Enter, recarga y retorno sin runtime del juego. Rutas `/` y `/index.html` aisladas y cero peticiones API/GIS; práctica con servidor estático real sin rankings, clasificación integrada con SQLite real.
4. `npm run test:functional`: 15/15 PASS, incluido arrastre mouse/touch, pinch, controles y respuestas.
5. `python3 -B -m unittest discover -s tests -p test_serve_static.py -v`: 4/4 PASS.
6. `make openspec-validate CHANGE=dashboard-home-landing`: PASS; `openspec validate --all --strict --no-interactive`: 15/15 PASS; `make openspec-guard-test`: 7/7 PASS; `git diff --check`: PASS.
7. Docker build real: PASS, imagen `sha256:cc8af4eafe04eea955d95cf9975ee28c2ac38546d2c8b35115497df970204f65`. `COMPOSE_SMOKE_ORIGIN=http://127.0.0.1:18095 node --test tests/compose.test.mjs`: 10/10 PASS (contenido idéntico al worktree, MIME/404/HEAD, Chromium, CTA, juego y respuestas reales).
8. Inspección visual de capturas reales `test-results/dashboard-1280.png` y `test-results/dashboard-320.png`: paneles y jerarquía legibles, CTA contrastado, sin recortes. La captura queda con foco visible en atribución tras recorrido completo. También generadas dashboard-375.png y dashboard-768.png. Son artefactos ignorados reproducibles, no fuentes versionadas.

Corrección durante GREEN: el primer navegador encontró que la flecha generada con `::after` cambiaba el nombre accesible de Jugar. Se retiró esa decoración, sin relajar el selector exacto ni la prueba de teclado; suite final verde.

## Límites y operación
- No Safari/iOS ni dispositivos físicos; móvil y touch Chromium emulados. Fuente 200% no equivale a certificar todos los modos de zoom de todos los navegadores.
- Sin migraciones, API nueva, cambios GIS ni dependencias runtime. No hay build frontend (HTML/CSS nativo); se construyó y ejercitó Docker real.
- No se ejecutó `tests/compose-smoke.sh`: limitación heredada documentada en GAME_ROUTE.md (runner no coincide con Compose/Traefik). Smoke Docker alternativo no certifica Compose, rollback ni despliegue.
- Advertencia del host: límite de memoria Docker no soportado; no se afirma que se aplicara. Contenedor verificado con usuario arrecifes, rootfs read-only y puerto solo loopback.
- La limpieza `docker stop/rm/image rm` fue bloqueada por el runtime de aprobación single-query ANTES de ejecutarse. No se evadió. Lectura posterior confirmó contenedor `arrecifes-dashboard-smoke-t_05dbedf9` (`c9e5c098896523f57e7a5ab83cd67b09ec61557894575a5d21bbbaa30ada0c78`) e imagen `arrecifes-dashboard-smoke:t_05dbedf9` aún presentes, ambos label `kanban.task=t_05dbedf9`; puerto 127.0.0.1:18095. Seguimiento operativo bloqueado para autorización: `t_fe621276`. No se tocó producción ni systemd.
- Revisión e integración pendientes de QA hija `t_2656ea05`. La finalización de esta tarjeta representa solo el hito de implementación para liberar esa dependencia, no aprobación final, merge, push ni despliegue.
