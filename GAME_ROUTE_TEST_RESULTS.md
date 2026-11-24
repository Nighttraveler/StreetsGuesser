# Evidencia t_2d0104cf — separación del juego

OpenSpec: separate-game-route, validado y comprometido ANTES de editar código en 3ec4115. Rama wt/t_2d0104cf; base común inicial con main 06a9bbee4d0cad1ab0fcb22b033cbf27c6819ff2. No se modificaron main, GIS, reglas, app.mjs, game.mjs ni compose.yaml.

## Ejecuciones reales

- RED: `node --experimental-sqlite --test --test-name-pattern='home is isolated' tests/city-home-browser.test.mjs`: falla 3 != 0, por mapa/formulario/script presentes en portada heredada.
- `npm test`: 36/36, incluyendo dos unitarias nuevas de contrato de documentos.
- `npm run test:functional`: primera ejecución 14/15, fallo de clic mouse 0 != 2 en tests/browser.test.mjs:237 (eventos apuntando a elemento sin ID). Segunda ejecución completa 15/15. No se cambió lógica para ocultarlo; existe historial previo de inestabilidad mouse en la base. No se afirma causa demostrada ni corrección de esa inestabilidad.
- `node --experimental-sqlite --test --test-concurrency=1 tests/city-home-browser.test.mjs tests/static-practice-browser.test.mjs tests/rankings-browser.test.mjs tests/rankings-integration.test.mjs tests/rankings-client.test.mjs`: 19/19. Catálogo real, selección contextual, sesión, publicación, dos propietarios y partidas completas con SQLite, recarga, errores/reintento. Portada sin módulos/fetch, CTA por teclado, entrada directa y recarga en Node y Python; Python móvil emulado 375x812 sin desborde.
- `python3 -m unittest discover -s tests -p test_serve_static.py -v`: 4/4, bytes, MIME, GET con query, HEAD sin cuerpo, privados 404.
- `make openspec-validate CHANGE=separate-game-route`: válido.
- `openspec validate --all --strict --no-interactive`: 14/14.
- `make openspec-guard-test`: 7/7.
- `git diff --check`: sin errores.

Node v22.22.3; Chromium 151.0.7922.173; Docker 26.1.5; imagen linux/arm64. Sin build frontend (estáticos nativos), dependencias ni migraciones nuevas.

## Docker y limitación operativa

`SMOKE_SUBNET=10.254.241.0/28 bash tests/compose-smoke.sh 18094` verifica no solapamiento pero se detiene ANTES de crear recursos: su contrato de red propia y defaults loopback es incompatible con compose.yaml heredado, que usa proxy externo/Traefik. No se cambió esa infraestructura fuera del alcance. No se certifican Compose completo, stop/start, recuperación ni rollback en esta tarjeta.

Alternativa ejecutada con build real:

    docker build -t arrecifes-de-memoria:route-t_2d0104cf .
    docker run -d --name route-t_2d0104cf --label traefik.enable=false --read-only --cap-drop ALL --security-opt no-new-privileges:true --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777 -p 127.0.0.1:18094:8080 arrecifes-de-memoria:route-t_2d0104cf
    COMPOSE_SMOKE_ORIGIN=http://127.0.0.1:18094 node --test tests/compose.test.mjs

Resultado final: 10/10 HTTP/Chromium, seis activos íntegros, hash GIS original, privados 404, portada aislada, CTA, entrada directa y recarga, niveles/aciertos. Primera ejecución 9/10 por errores de consola de rankings-ui.mjs opcional ausente: el test heredado asumía cero 404. Se cambió exclusivamente para permitir el mensaje exacto de 404 de esa URL, exigir tres respuestas 404 y comprobar fallback de clasificado; cualquier otro error sigue fallando.

Imagen: sha256:e77cb037d53b3b3d2a9b88dc44e1b04f05236ea2510dee883bd4a68b2279745f.
Contenedor: 8a5d05fe0d9c76dee552a900e158a62341b2ebd45c415b6a5de9ad33c48bb79f, nombre route-t_2d0104cf. Inspección confirma read-only=true, usuario arrecifes, CapDrop=[ALL], puerto únicamente 127.0.0.1:18094.

PENDIENTE OPERADOR: el comando de limpieza fue denegado antes de ejecutarse por la política headless single-query (docker stop requiere aprobación). No se intentó eludirla. Parar y eliminar SOLO este contenedor y su etiqueta de imagen, tras comprobar ID:

    docker stop route-t_2d0104cf
    docker rm route-t_2d0104cf
    docker image rm arrecifes-de-memoria:route-t_2d0104cf

El contenedor de prueba sigue activo hasta esa intervención. No se tocó systemd ni producción. La tarjeta debe bloquearse por esta operación y por decisión sobre el runner Compose heredado, no entregarse como fase cerrada. La implementación queda commiteada para retomar sin pérdida. QA posterior está en t_2656ea05, después del landing t_05dbedf9. Sin integración ni push.
