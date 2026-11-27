# Backend de rankings (t_1a20dae1)

Contrato: RANKINGS_SPEC.md; OpenSpec add-city-difficulty-rankings, incorporado y validado antes del código en commit 6e9b583. Este documento entrega la fase backend para QA; no declara integrado el sistema completo.

## Runtime y ejecución local

Validado en Linux ARM64 con Node 22.22.3 y SQLite nativo 3.51.3. No se agregaron paquetes runtime. `node:sqlite` sigue siendo experimental en Node 22 y necesita `--experimental-sqlite` (incluido en scripts npm). Se requiere Node >=22.22; usar la versión probada para reproducir.

Desde la raíz del worktree integrado con UI (servicios en backend/, estáticos en frontend/; ver REPOSITORY_LAYOUT.md):

    RANKINGS_DEVELOPMENT=1 RANKINGS_DB=/ruta/privada/rankings/state.db npm run start:rankings

Escucha por defecto en 127.0.0.1:8081, origen exacto http://127.0.0.1:8081. RANKINGS_HOST, RANKINGS_PORT y RANKINGS_ORIGIN permiten configurar explícitamente otro loopback/puerto; no mezclar localhost y 127.0.0.1. El directorio privado debe estar fuera del árbol público, ser persistente y tener permisos 0700. Los tests usan TMPDIR del agente y eliminan sus fixtures.

El harness sirve exclusivamente index.html, play.html, styles.css, app.mjs, game.mjs, arrecifes_calles.json, rankings-ui.mjs y ranked-game-client.mjs desde frontend/ en URLs raíz; también `/api/v1`. Si un activo UI no existe devuelve 404, no un módulo vacío ni éxito ficticio. Nunca publica código backend, DB, pruebas, Git o documentación. El modo práctica no necesita la API. SIGTERM/SIGINT cierran HTTP y SQLite limpiamente.

## Configuración de producción (sin despliegue)

Sin RANKINGS_DEVELOPMENT=1 el ejecutable exige RANKINGS_ORIGIN HTTPS. RANKINGS_SERVE_FRONTEND=1 permite servir los mismos activos junto con la API cuando un proxy externo termina TLS. NODE_ENV=production prohíbe el modo de cookie HTTP. No acepta tráfico HTTP API aunque el cliente falsifique X-Forwarded-Proto. Un terminador TLS explícitamente confiable se declara mediante RANKINGS_TRUSTED_PROXY=<dirección IP exacta del peer>; debe preservar Host y sobrescribir X-Forwarded-Proto con https. Solo desde ese peer se acepta X-Forwarded-For con UNA dirección IP validada, nunca cadenas arbitrarias. Sin header válido usa la IP del socket. Restringir además por firewall el puerto API al proxy. No activar CORS ni registrar cookies/respuestas de jugadores en logs del proxy.

Cookie de producción __Host-arrecifes_session: Secure, HttpOnly, SameSite=Lax, Path=/, sin Domain, 180 días. Cookie HTTP de desarrollo solo loopback. No hay recuperación al perder la cookie. El nombre no autentica. La API no registra respuestas, cookies, SQL ni texto de jugadas en stdout; errores HTTP son JSON seguro.

El cambio enable-rankings-in-compose empaqueta Node y habilita web y API por defecto en Docker con HTTP restringido al loopback del host. El volumen privado conserva SQLite y snapshots. La activación con TLS se configura por separado. Consultar [DEPLOYMENT.md](DEPLOYMENT.md) para el arranque, respaldo y verificación.

## Datos y migraciones

`backend/ranked-game/database.mjs` abre una conexión síncrona de un único proceso escritor. Cada conexión activa foreign_keys, WAL y busy_timeout=5000. Migración 001-rankings.sql transaccional con checksum en schema_migrations; un segundo arranque no la vuelve a aplicar y un checksum diferente se rechaza. Fallos de negocio revierten nombre, submission, mejor marca y respuesta de idempotencia juntos. SQLITE_BUSY agotado produce 503 RETRY_LATER y Retry-After: 1. El proceso síncrono puede esperar hasta cinco segundos; no escalar a múltiples réplicas sobre un volumen compartido/NFS.

El servidor registra solo Arrecifes y sus dificultades presentes. `Catalog` recibe registros administrativos internos, nunca rutas del formulario. Valida IDs OSM únicos y reglas soportadas (versión 1). Copia bytes exactos a RANKINGS_DB.datasets/<sha256>.json y conserva snapshots históricos privados. Comprueba el hash al arrancar. El registro configurado es la fuente de activación al iniciar: cambiar versión exige cambiar el registro administrativo, no solamente hacer UPDATE transitorio a boards (el próximo inicio volvería a aplicar la configuración). No hay endpoint administrativo de carga/activación ni se importa el descargador paralelo. La segunda ciudad en tests es explícitamente sintética y no se registra en el ejecutable.

`Games.getCompletedOwned` implementa la frontera interna VerifiedGameReader dentro de la misma transacción de publicación. Verifica owner, estado, plazos, versión, conteo y suma durable. `Games` reutiliza matchesAnswer/updateState/selectStreet/streetId/hintFor de game.mjs sin modificarlo. La API pública nunca recibe un resultado verificado desde JavaScript. Toda mutación de juegos/publicaciones requiere UUID v4 en Idempotency-Key; replay conserva status/body originales. Otra clave para submission existente devuelve 200 sin cambiar nombre ni mejor marca incluso tras vencimiento/retirada.

No se migran datos de práctica ni existe DB anterior que convertir. No hay downgrade destructivo automático: rollback operativo deshabilita el modo clasificado, conserva DB/snapshots y mantiene práctica. No editar una migración aplicada.

## Backup y restauración

Con un directorio destino privado previamente creado:

    node --experimental-sqlite backend/ranked-game/backup.mjs /ruta/privada/state.db /ruta/backup/nuevo.db

Usa SQLite backup online y verifica integrity_check/foreign_key_check; rechaza destino existente. No copiar solo .db mientras WAL esté activo. Conservar también todos los snapshots inmutables .db.datasets: contienen las versiones históricas que la DB referencia. La restauración probada es local preservando las rutas absolutas de snapshots. Para otro host/directorio, detener la API, restaurar snapshots y remapear datasets.immutable_path por operación administrativa revisada antes de arrancar; no mover solo la DB ni perder el WAL de la fuente. Hacer una restauración de ensayo antes de una activación productiva.

## Verificación reproducible

    npm ci --ignore-scripts
    npm test
    npm run test:functional
    node --experimental-sqlite --test --experimental-test-coverage --test-coverage-include='backend/ranked-game/*.mjs' --test-coverage-include='backend/rankings/*.mjs' tests/sqlite-runtime.test.mjs tests/rankings.test.mjs
    make openspec-validate CHANGE=add-city-difficulty-rankings
    openspec validate --all --strict --no-interactive
    make openspec-guard-test
    python3 -m unittest discover -s tests -p 'test_*.py' -v
    git diff --check

Las pruebas backend ejercitan HTTP/SQLite reales: canonicalización y CHECK/UNIQUE, aislamiento por ciudad/dificultad/version, mejor marca, score/time/UUID, consentimientos, owner, manipulación de payload, replay/conflicto, acciones/pistas/saltos, expiración exclusiva, rate limits, origen/proxy/cookies, rollback inyectado, bloqueo SQLite, dos procesos escritores, persistencia, migraciones repetidas, backup CLI/restauración y SIGTERM/reinicio del ejecutable. Una partida real fácil recorre 15 IDs distintos y publica 150 puntos. No hay servidor falso ni fixture de score aceptada por API.

Resultados ejecutados: npm test 31/31; backend con cobertura 17/17 (98.50% líneas, 88.89% ramas, 98.80% funciones; cobertura V8 incluye procesos hijos). OpenSpec local PASS, global estricto 8/8, guard 7/7 y Python 22/22. npm ci sin scripts y auditoría de dependencias: 0 vulnerabilidades reportadas. No hay compilación TypeScript/bundler ni nuevas dependencias que construir; Docker no se modifica y no se afirma un build de la futura API productiva.

La suite Chromium heredada verificó práctica y regresión. La primera corrida tuvo 11/12: fallo de arrastre/foco en tests/browser.test.mjs:149; repetición íntegra sin cambiar código/tests pasó 12/12. Se informa el primer fallo, no se oculta mediante relajación de aserciones. El flujo de UI de rankings real corresponde a t_0a5316a1 y a QA conjunta t_ad651c3c.

## Límites y entrega

SQLite no garantiza conocimiento humano: el dataset público permite automatizar respuestas. Una persona puede crear identidades en múltiples dispositivos. Nombres inmutables globales, sin moderación/renombre/recuperación en MVP. Paginación actual por offset puede desplazarse entre requests; una lectura individual sí usa snapshot coherente.

QA debe revisar esta rama junto al candidato UI, combinar la documentación OpenSpec compartida preservando las tareas de ambas fases, ejecutar matriz §10 y verificar integración autorizada en main antes de cerrar el sistema. Esta fase no hace merge, push, release ni despliegue. Hash del candidato y lista completa de archivos/pruebas se registran en el handoff Kanban.
