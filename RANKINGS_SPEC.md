# Rankings v1 — contrato de implementación

Estado: decisión arquitectónica de t_82819d4f; especificación previa, no implementación ni aprobación de despliegue. Base inspeccionada: ead38d0654beeed77720ccc464169286da250c5a. Fuente normativa compartida por backend t_1a20dae1, UI t_0a5316a1 y QA t_ad651c3c. Cambio OpenSpec: add-city-difficulty-rankings.

## 1. Evidencia del sistema actual

- game.mjs:31-44 identifica calles por osm_way_ids ordenados y calcula progreso único por nivel. game.mjs:47-55 evita calles resueltas y devuelve null al completar.
- game.mjs:58-77 define estado volátil: score, streak, hinted, resolved, solvedByLevel. Acierto suma 10 o 5 con pista; error y salto reinician racha, no restan puntos. No hay entidad persistente de partida ni jugador.
- app.mjs:168-198 evalúa respuestas y pistas enteramente en cliente. app.mjs:205-220 reinicia score al cambiar nivel pero conserva solvedByLevel; ese score NO representa necesariamente una partida completa de esa dificultad.
- app.mjs:232-250 carga un único dataset local; index.html:33 enumera 1/Fácil, 2/Medio, 3/Difícil. No hay catálogo persistente de ciudades ni selector actual de ciudad.
- serve_static.py:8-14,27-40 solo publica activos GET/HEAD. package.json:5-12 no contiene backend o DB. Dockerfile:1-10 usa Python para estáticos. No existen usuarios, estudios, organizaciones ni multitenancy: NO importar estudio_id ni modelos de Lawyers Hub.

Conclusión: es obligatorio añadir identidad y un flujo mínimo de partida autoritativa. No basta con una tabla de puntuaciones y no se importan partidas locales históricas.

## 2. Decisiones de producto explícitas (nuevas, no deducidas)

1. Ranking público, opt-in, de carácter recreativo; no competitivo con premios. Un tablero activo por (city_id, difficulty), sin ranking global combinado.
2. Solo partidas online iniciadas desde cero y completadas cuentan. Práctica local sigue disponible sin API y nunca se publica. No mezclar progreso local, puntos de diferentes niveles o partidas.
3. Un resultado visible por jugador/tablero: su mejor puntaje. Mantener partidas/publicaciones anteriores internamente. Igual puntaje personal conserva la primera marca; uno peor no reemplaza. No penalizar errores ni usar tiempo/racha como métrica oculta.
4. Orden: score DESC, completed_at ASC, game_id ASC (UUID canónico ASCII). Posiciones ordinales 1,2,3, sin posiciones compartidas. El primer finalizador gana el desempate aunque publique más tarde. Timestamps UTC de servidor, precisión de milisegundos; UUID resuelve simultaneidad.
5. Identidad de dispositivo mediante cookie anónima; no contraseña, email ni recuperación en MVP. Nombre NO es credencial. Borrar cookie implica perder acceso a ese jugador y su nombre; UI debe advertirlo antes de publicar. Compartir navegador comparte identidad. No prometer identidad humana única ni impedir múltiples dispositivos.
6. Nombre global en toda la instalación (todas las ciudades/dificultades), reservado al primer registro válido. Inmutable en MVP, sin renombre/reasignación ni expiración automática. Publicar nuevo resultado con el propio nombre es válido.
7. Catálogo inicial: arrecifes (Arrecifes), dificultades 1,2,3. Otros datasets deben activarse explícitamente por administración, nunca subirse desde el formulario. No depender del descargador de ciudades en desarrollo paralelo.
8. Un cambio de dificultad en modo clasificatorio abandona la partida activa tras confirmación y crea otra desde cero. Completar conserva game_id para publicar incluso si el jugador decide subir de nivel después. Una partida activa por jugador; reintento de inicio debe ser idempotente.
9. Cada tablero fija dataset_version y rules_version. Cambiar datos/reglas no compara puntuaciones incompatibles: activar nueva versión vacía la vista activa por cambio de filtro, conservando historia privada. Las partidas de versión retirada no son publicables. Sin UI de temporadas históricas en v1.
10. Finalizar dentro de 24 horas desde inicio; publicar dentro de 7 días desde finalización (límite exclusivo: now >= deadline es vencido). Relecturas de una publicación ya aceptada no caducan. Son límites operativos, no una métrica de habilidad.

## 3. Alternativas y decisión técnica

### Persistencia y ejecución

A. Node ES modules + SQLite, un proceso API, volumen local. Pros: reutiliza exactamente game.mjs, sin DB adicional, UNIQUE/transactions reales. Contras: escritor único, requiere runtime Node adicional al Python estático; node:sqlite en Node 22 usa flag experimental. Coste orientativo: 3–5 días backend incluidas partidas/auth/tests, 2–3 días UI; infraestructura un proceso y disco persistente; operación backup periódico. Reversibilidad media: repositorio encapsulado permite migrar a PostgreSQL, exportando tablas. RECOMENDADA MVP: Node >=22.22 con --experimental-sqlite, versión fijada y probada en imagen; no añadir dependencias sin manifest/lock. El implementador debe validar node:sqlite en su entorno antes de código. No se ha probado el binding en esta entrega documental.

B. Node + PostgreSQL. Pros: múltiples escritores, mejores operaciones concurrentes a escala. Contras: servicio, credenciales, migraciones/backup adicionales para una aplicación actualmente estática. Coste: mayor tiempo ops e infraestructura; reversibilidad media. Elegir al requerir varias réplicas escritoras o si métricas de SQLITE_BUSY/latencia muestran saturación; no introducirlo por anticipación.

### Confianza e identidad

A. Cookie anónima + servidor evalúa cada acción. Pros: no registro previo ni contraseñas; impide editar score o apropiarse de game_id. Contras: pérdida de identidad al borrar cookie, automatización posible. Coste moderado; reversible añadiendo cuentas vinculadas sin cambiar player_id. RECOMENDADA.

B. Cuentas autenticadas y medidas anti-cheat fuertes. Pros: recuperación y mayor resistencia a abuso. Contras: onboarding, PII, operación y más alcance. Coste alto; reversible, pero migrar identidades exige consentimiento.

C. Aceptar score/log enviado al finalizar. Pros: mínimo coste. Contras: cliente fabrica acciones/tiempos/puntos; no cumple validación exigida. Reversibilidad mala para confianza de datos. RECHAZADA.

Dataset público y código abierto permiten resolver automáticamente las preguntas. Servidor autoritativo significa integridad del protocolo, NO prueba de conocimiento humano. Pista/salto también permiten aprender respuestas; se mantienen reglas actuales deliberadamente.

## 4. Límites del módulo y ownership

Actualización de ubicaciones, OpenSpec separate-frontend-backend: rankings/ y ranked-game/ de esta sección viven ahora bajo backend/, con su migración SQL intacta. Los módulos de interfaz y el único game.mjs están en frontend/; el adaptador backend importa ../../frontend/game.mjs. API, reglas y ownership no cambian. El inventario de §1 es evidencia histórica previa a implementar rankings, no inventario vigente. Ver REPOSITORY_LAYOUT.md.

- rankings/: dominio de nombres/publicación/consulta, repositorio SQLite y handlers HTTP. Sin DOM, sin selección de calles ni cálculo de puntos.
- ranked-game/: identidad/sesiones, catálogo inmutable, motor de partidas/acciones, adaptador que importa game.mjs (matchesAnswer, updateState, streetId, selectStreet, hintFor). No duplicar normalización de respuestas en otro lenguaje.
- Interfaz interna VerifiedGameReader.getCompletedOwned(gameId, playerId, transaction) retorna resultado inmutable con city/difficulty/versions/score/completed_at/solved_count/total, o error tipado. Solo acceso interno; no endpoint de importación de resultados.
- Registro y lectura de resultado ocurren en la misma DB/transacción; al completar se congela score. El módulo rankings nunca acepta un objeto VerifiedGame del navegador.
- Frontend nuevo rankings-ui.mjs + ranked-game-client.mjs. La integración mínima en app.mjs cambia a acciones HTTP solo en modo clasificatorio; no ejecutar el motor local y después reportar su score.
- Backend posee rankings/, ranked-game/, migraciones, tests API y scripts npm propios. UI posee módulos de interfaz, app.mjs/index.html/styles.css y pruebas de navegador. No editar game.mjs para añadir ranking. package.json/lock, allowlist de serve_static.py y Docker/Compose son hotspots: coordinar cambios en backend y consumirlos en UI, no dos implementaciones paralelas.
- Desarrollo/test: mismo origen mediante servidor de composición de prueba con allowlist explícita de activos y /api/v1. Producción planificada: estáticos existentes + API separada por regla de ruta /api/v1 de mayor prioridad bajo mismo host, SQLite fuera del árbol público. No servir repositorio completo. No cambiar systemd, directorio público externo ni desplegar aquí. Activación posterior requiere ventana y pruebas Docker/TLS.

## 5. Modelo de datos lógico y restricciones

UUID v4 canónico lowercase para player_id, game_id, round_id y session_id, generados criptográficamente. Fechas almacenadas como milisegundos UTC enteros; API ISO-8601 con Z. Enteros de score/conteos, nunca floats. Migraciones versionadas/transaccionales; foreign_keys=ON por conexión, WAL, busy_timeout=5000. DB en volumen local exclusivo, no NFS. Copia consistente con SQLite backup, no copiar solo .db ignorando WAL; prueba de restauración antes de despliegue.

- players(id PK, created_at). No datos personales adicionales.
- sessions(token_hash PK, player_id FK RESTRICT, created_at, expires_at). Token aleatorio de 32 bytes; guardar hash SHA-256, no token en DB/logs. Expiración fija 180 días; no resucitar sesión vencida por nombre. Índice sessions(player_id).
- usernames(player_id PK FK RESTRICT, username TEXT UNIQUE COLLATE BINARY, claimed_at). username es ya canónico; CHECK formato/longitud equivalente al validador. Una fila por jugador y nombre global único.
- cities(id TEXT PK, display_name). id slug ASCII estable ^[a-z0-9]+(?:-[a-z0-9]+)*$ de máximo 64 caracteres.
- boards(city_id FK RESTRICT, difficulty INTEGER CHECK IN(1,2,3), active_dataset_version, active_rules_version, PK(city_id,difficulty)). No board implica dificultad no disponible.
- datasets(city_id, version, content_hash, immutable_path, PK(city_id,version), FK city RESTRICT). Version = SHA-256 hexadecimal del archivo de bytes exactos registrado; fijar mapping de calles por streetId, rechazar IDs repetidos. Path administrativo no derivado de input HTTP.
- games(id PK, player_id FK RESTRICT, city_id, difficulty, dataset_version, rules_version, status, score, streak, total, solved_count, started_at, completed_at nullable, expires_at, current_round_id nullable, revision). FK(city_id,difficulty) a boards y FK(city_id,dataset_version) a datasets RESTRICT. status active/completed/abandoned/expired. CHECK score>=0, total>0, 0<=solved_count<=total; completed exige solved_count=total y completed_at no nulo. Snapshot immutable al completar. Índice games(player_id,started_at); UNIQUE parcial games(player_id) WHERE status='active'. Expirar partida vencida dentro de transacción antes de crear otra.
- rounds(id PK, game_id FK RESTRICT, ordinal, street_id, hinted boolean, resolved boolean, outcome nullable correct/skip, UNIQUE(game_id,ordinal)). Street pertenece al snapshot y al nivel; solo ronda actual acepta acciones. Pista es por ronda, igual al juego actual.
- solved_streets(game_id FK RESTRICT, street_id, points CHECK IN(5,10), PK(game_id,street_id)). Fuente durable de progreso único y score acumulado. Cada acierto inserta una sola vez; score = suma(points), solved_count = count(*). Errores/saltos no insertan.
- submissions(game_id PK FK RESTRICT, player_id FK RESTRICT, created_at). Consentimiento único por partida, inmutable. Igualdad del owner con games validada transaccionalmente; el repositorio no expone inserción arbitraria.
- leaderboard_entries(city_id, difficulty, dataset_version, rules_version, player_id FK RESTRICT, game_id UNIQUE FK RESTRICT, score, completed_at, PK(city_id,difficulty,dataset_version,rules_version,player_id)). Solo referencia submissions aceptadas; owner/board/score/time copiados de games por servicio transaccional, nunca del body. Índice de lectura: (city_id,difficulty,dataset_version,rules_version,score DESC,completed_at ASC,game_id ASC).
- idempotency(player_id, key, method, path, request_hash, response_status, response_json, created_at, PK(player_id,key)). Se conserva mientras se conserve el jugador en MVP. Evita doble acción y permite replay exacto. No guardar cookies ni respuestas de creación de sesión aquí.

FK por defecto RESTRICT, no cascadas ocultas. Sin borrado/renombre público ni soft-delete en MVP; eventual borrado de privacidad requiere operación administrativa explícita sobre dependientes y revisión de política, no endpoint improvisado. No prometer retención limitada: historial persiste; logs operativos sin texto de respuestas/cookie y rotación acotada.

## 6. Nombre de usuario

Algoritmo exacto, distinto de normalizeName de calles:
1. JSON string; máximo 64 code points en input, antes de normalizar.
2. Quitar exclusivamente espacios ASCII U+0020 de ambos extremos.
3. Convertir exclusivamente A-Z a a-z.
4. Validar ^[a-z0-9_]{3,20}$; sin Unicode, tildes, espacios internos, guiones, tabs o saltos de línea. No NFKC ni transliteración implícita. Guardar/mostrar únicamente canónico.
5. Reservados: admin, administrator, moderator, support, system, anonymous. Error USERNAME_RESERVED.

Ejemplos: " Ana_7 " y "ANA_7" -> ana_7; "ánita", "ana-7", "ana 7", "ab", "\tana" inválidos. La restricción UNIQUE aplica al canónico, no al input original. Si username pertenece al player autenticado: aceptar. Si pertenece a otro: 409 USERNAME_TAKEN, nunca devolver su player_id. Si jugador ya posee otro nombre: 409 USERNAME_LOCKED. No endpoint público de disponibilidad: no reservar ni afirmar disponibilidad en frontend; resultado definitivo solo al publicar una partida válida.

## 7. Seguridad y transacción de publicación

GET de catálogo/ranking público; GET /session y todas las partidas requieren cookie válida. GET partida ajena devuelve 404 GAME_NOT_FOUND, indistinguible de inexistente. Mutaciones requieren Origin exacto configurado y Content-Type application/json; no CORS wildcard ni token en localStorage/URL. POST /session también comprueba Origin. Cookie producción: __Host-arrecifes_session; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=15552000; sin Domain. En desarrollo solo loopback HTTP admite nombre arrecifes_session sin Secure, configuración explícita prohibida en producción. El HTTP LAN actual no es apto para identidad segura: producción requiere HTTPS sin downgrade para endpoints API.

Publicar: validar sesión/origen/body, normalizar username, BEGIN IMMEDIATE, comprobar idempotencia, buscar partida con owner, verificar status completed/plazos/version activa y progreso total/puntaje congelado; reservar nombre bajo UNIQUE; insertar submission si no existe; insertar/mejorar entrada si score supera mejor score. Si score igual conservar la marca existente de ese jugador. Guardar respuesta de idempotencia y commit. Ante cualquier error de negocio rollback completo: ni nombre reservado ni submission parcial. Reintento de submission ya existente del mismo jugador/nombre retorna éxito aunque haya vencido plazo/cambiado versión; no la re-publica en tablero nuevo. No permitir nuevos nombres en ese reintento.

Carrera de nombres: dos jugadores con mismo canónico -> uno éxito, otro USERNAME_TAKEN; convertir constraint en error de dominio. Carrera personal entre puntajes -> serializar escritura y re-comparar, nunca perder mejor marca. Un archivo SQLite es suficiente en MVP; no advisory locks ni Redis.

Todos los POST salvo /session requieren Idempotency-Key UUID v4 nuevo por intención, reutilizado ante timeout con mismo body. Clave global por jugador; request_hash sobre method + path + JSON canónico (claves ordenadas, valores exactos; no equivalencia de usernames antes del hash). Replay de éxito devuelve mismo status/body sin ejecutar; misma key con otro contenido -> 409 IDEMPOTENCY_CONFLICT. Errores no se guardan; UI conserva clave al reintentar transporte y genera nueva al corregir formulario. Cambio con mismo game_id y otra clave sigue siendo idempotente por submissions.game_id. POST /session con cookie válida retorna identidad existente; nunca rota en cada visita. Pérdida de primera respuesta puede crear identidad huérfana sin nombre: aceptado.

Límites por instancia: body máximo 4096 bytes (413); answer máximo 200 code points (422); 120 mutaciones/minuto por sesión, 20 creaciones de sesión/minuto por IP (429 con Retry-After entero segundos). Proxy IP solo confiable si proviene del proxy configurado, no X-Forwarded-For arbitrario. SQLITE_BUSY agotado -> 503 RETRY_LATER y Retry-After: 1; rollback seguro. No registrar stack/SQL/PII en respuesta.

## 8. Convenciones API v1

Prefix /api/v1. JSON UTF-8; fechas ISO; IDs string; difficulty JSON integer 1|2|3, en query decimal sin ceros iniciales. Campos desconocidos se rechazan 422 UNKNOWN_FIELD, especialmente score/player_id/city_id/difficulty en registro. JSON roto 400 INVALID_JSON; media type erróneo 415 UNSUPPORTED_MEDIA_TYPE. GET no cambia estado de juego (puede mostrar expired derivado del reloj). Todas las respuestas de sesión/juego/mutación llevan Cache-Control: no-store; ranking también no-store en MVP. No HTML de error.

Error común (ejemplo de conflicto):
```json
{"error":{"code":"USERNAME_TAKEN","message":"Ese nombre ya está ocupado. Elegí otro.","field":"username","retryable":false}}
```
field string o null, retryable boolean siempre presentes. UI usa code; message seguro en español. Mapeo obligatorio:
- 400 INVALID_JSON, INVALID_QUERY (query desconocida, duplicada o formato incorrecto).
- 401 SESSION_REQUIRED (ausente/vencida).
- 403 ORIGIN_FORBIDDEN.
- 404 CITY_NOT_FOUND, BOARD_NOT_FOUND, GAME_NOT_FOUND.
- 409 USERNAME_TAKEN, USERNAME_LOCKED, IDEMPOTENCY_CONFLICT, ACTIVE_GAME_EXISTS, STALE_ROUND, GAME_NOT_ACTIVE, GAME_NOT_ELIGIBLE, BOARD_VERSION_CHANGED.
- 422 INVALID_USERNAME, USERNAME_RESERVED, UNKNOWN_FIELD, INVALID_FIELD, IDEMPOTENCY_KEY_REQUIRED (también clave malformada).
- 413 BODY_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE, 429 RATE_LIMITED, 503 RETRY_LATER.
Solo 429/503 retryable=true; errores de transporte también reintentables por cliente. UUID malformado en ruta -> 404 GAME_NOT_FOUND; city slug desconocido bien formado -> 404 CITY_NOT_FOUND. En POST /games invalid difficulty/body -> 422 INVALID_FIELD; combinación inexistente -> 404 BOARD_NOT_FOUND.

### 8.1 Catálogo e identidad

GET /catalog -> 200
```json
{"cities":[{"id":"arrecifes","name":"Arrecifes","difficulties":[{"id":1,"name":"Fácil"},{"id":2,"name":"Medio"},{"id":3,"name":"Difícil"}]}]}
```
POST /session body {} -> 201 si crea, 200 si cookie válida, y Set-Cookie solo al crear:
```json
{"player":{"id":"00000000-0000-4000-8000-000000000001","username":null}}
```
GET /session -> 200 mismo shape, username canónico o null; 401 sin sesión. player.id solo privado, jamás en ranking público. UI inicializa sesión al elegir jugar clasificado, no al consultar ranking público.

### 8.2 Partidas autoritativas (prerrequisito de rankings)

POST /games + Idempotency-Key, body {"city_id":"arrecifes","difficulty":1} -> 201 GameView. Snapshot dataset/rules/total tomado de servidor. Otra partida activa -> 409 ACTIVE_GAME_EXISTS (UI recupera con GET /games/active). GET /games/active -> 200 {"game": GameView|null}; no lista todo el historial. GET /games/{game_id} -> 200 GameView propia, incluso terminal.

GameView (ejemplo inicial, total ilustrativo a resolver del dataset real):
```json
{"id":"00000000-0000-4000-8000-000000000010","city_id":"arrecifes","difficulty":1,"dataset_version":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","rules_version":"1","status":"active","score":0,"streak":0,"progress":{"correct":0,"total":15},"revision":0,"completed_at":null,"eligible_for_ranking":false,"round":{"id":"00000000-0000-4000-8000-000000000011","street_id":"100,101","hinted":false,"resolved":false,"hint_text":null,"revealed_name":null}}
```
Ejemplos sintéticos, no datos ni respuestas ejecutadas. street_id corresponde al snapshot usado por mapa; cliente debe comprobar versión de dataset antes de jugar. Catálogo de activos del modo clasificado: GET /cities/{city_id}/datasets/{dataset_version} -> 200 array de calles con formato actual; solo versiones registradas, sin acceso a rutas arbitrarias, 404 CITY_NOT_FOUND o DATASET_NOT_FOUND. Se puede cachear versión inmutable; siempre atribuir OSM. Si versión local difiere, cargar esta, no mapear IDs contra otra versión.

POST /games/{id}/actions + Idempotency-Key, body:
```json
{"round_id":"00000000-0000-4000-8000-000000000011","type":"answer","answer":"ruta 8"}
```
type answer|hint|skip|next; answer obligatorio/no vacío solo para answer, prohibido en otros. Servidor autentica owner, locks/BEGIN IMMEDIATE y valida current round. round_id ajeno/viejo -> 409 STALE_ROUND. En ronda no resuelta answer evalúa matchesAnswer, error conserva ronda y reinicia racha, acierto inserta solved_streets y puntos una sola vez. hint idempotente por ronda; devuelve hintFor y fija hinted=true antes de puntuar. skip resuelve sin progreso y revela nombre; next solo tras resolved crea ronda no resuelta con selección del servidor entre no acertadas, evitando anterior si hay alternativa. next tras ronda no resuelta -> 409 GAME_NOT_ACTIVE. answer/hint/skip tras resolved -> 409 GAME_NOT_ACTIVE; repeat de misma key reproduce respuesta. Al último acierto congela completed/score/time, sin next requerido. Respuesta 200:
```json
{"outcome":"wrong","game":{"id":"00000000-0000-4000-8000-000000000010","city_id":"arrecifes","difficulty":1,"dataset_version":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","rules_version":"1","status":"active","score":0,"streak":0,"progress":{"correct":0,"total":15},"revision":1,"completed_at":null,"eligible_for_ranking":false,"round":{"id":"00000000-0000-4000-8000-000000000011","street_id":"100,101","hinted":false,"resolved":false,"hint_text":null,"revealed_name":null}}}
```
outcome correct|wrong|hint|skip|next. revision sube por mutación efectiva, no por replay; no usarla en lugar de round_id. GameView terminal mantiene última ronda para feedback; eligible_for_ranking verdadero solo completed, dentro de plazo y versión activa. hint_text aparece solo tras hint, revealed_name solo correct/skip. No exponer respuesta desde API antes de resolver (aunque dataset público ya contiene nombres).

POST /games/{id}/abandon body {} + key -> 200 GameView status abandoned; repetición sobre abandoned éxito, sobre completed/expired 409 GAME_NOT_ACTIVE. No abandono de partida ajena. Reiniciar nivel exige abandon y nueva game, no reusar score/solved. UI conserva vista final/game_id para publicar sin depender del score visible de otra partida. Recarga recupera active o último game_id almacenado localmente como referencia, nunca como credencial.

### 8.3 Registro de resultado

POST /rankings/submissions + cookie + key; único body permitido:
```json
{"game_id":"00000000-0000-4000-8000-000000000010","username":" Ana_7 "}
```
201 primera publicación, 200 partida ya publicada (excepto replay exacto de key que repite 201 original):
```json
{"submission":{"game_id":"00000000-0000-4000-8000-000000000010","username":"ana_7","city_id":"arrecifes","difficulty":1,"score":145,"completed_at":"2026-11-23T16:00:00.000Z"},"best":{"game_id":"00000000-0000-4000-8000-000000000010","score":145,"completed_at":"2026-11-23T16:00:00.000Z"},"improved":true,"already_submitted":false}
```
Primera marca: improved=true. Puntaje inferior o igual: best apunta al anterior e improved=false; sí hay submission y mensaje "Resultado guardado; conservás tu mejor marca". Partida previamente publicada con nueva key: improved=false, already_submitted=true, best actual de su versión. No posición en respuesta de escritura: UI refresca consulta; una posición calculada antes de commit podría quedar obsoleta.

Ejemplos de errores:
```json
{"error":{"code":"GAME_NOT_FOUND","message":"Partida no encontrada.","field":"game_id","retryable":false}}
```
404 para ajena/inexistente. 409 GAME_NOT_ELIGIBLE para active, abandoned, expired, incompleta o publicación fuera de plazo; 409 BOARD_VERSION_CHANGED si resultado completo pertenece a versión retirada. 422 UNKNOWN_FIELD/field score al agregar score:9999; idéntico rechazo para city_id, difficulty o player_id en este body. No fiarse de valores ocultos del form.

### 8.4 Consulta

GET /rankings?city_id=arrecifes&difficulty=1&limit=20&offset=0 -> 200. city_id y difficulty obligatorios; limit opcional default20, rango1..100; offset default0, rango0..10000. Enteros decimales sin signo/ceros iniciales salvo 0. No filtros por jugador suministrado, orden arbitrario ni búsqueda de usuarios.
```json
{"city_id":"arrecifes","difficulty":1,"dataset_version":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","rules_version":"1","items":[{"position":1,"username":"ana_7","score":145,"completed_at":"2026-11-23T16:00:00.000Z"},{"position":2,"username":"bea_9","score":145,"completed_at":"2026-11-23T16:01:00.000Z"}],"pagination":{"limit":20,"offset":0,"total":2,"has_more":false}}
```
Vacío válido: items=[], total=0, has_more=false, mismas propiedades de board/versions/pagination. Offset fuera de resultados devuelve vacío; nunca cambia a otra ciudad/dificultad. Sin UUIDs privados en items. COUNT e items leídos en una transacción snapshot; position=offset+ordinal local. Orden SQL usa índice de sección 5. Total es entradas visibles de versión activa exclusivamente. Paginación offset elegida por bajo volumen y simple UI; páginas entre requests NO congelan clasificación, puede haber desplazamientos ante mejores marcas. Indicar "clasificación actual" y ofrecer refrescar desde offset=0. Reversibilidad alta a cursor versionado en API futura, sin prometer estabilidad entre páginas hoy.

## 9. UI y reparto para ejecución paralela

- Entrada explícita "Jugar clasificado" frente a práctica. No ofrecer publicar progreso heredado. Si API no disponible, explicar y ofrecer práctica, nunca afirmar envío exitoso ni convertir práctica silenciosamente.
- Selector ciudad/dificultad desde /catalog, vacío/error/reintento. Inicialmente una ciudad, tres dificultades; no campos de ciudad libres. El ascenso en clasificado inicia otra partida, con snapshot nuevo.
- Finalización: mostrar puntos del GameView y form username, consentimiento de publicación pública y aviso de identidad ligada al navegador. Con username existente prellenado solo lectura; nombres disponibles solo confirma backend.
- Validación local para ayuda, servidor siempre definitivo. Durante envío deshabilitar doble submit; key estable en retries de red. USERNAME_TAKEN: mensaje claro, conservar resultado para otro nombre. USERNAME_LOCKED: recargar /session. SESSION_REQUIRED: no recrear identidad y reclamar la partida anterior; avisar pérdida/expiración. GAME_NOT_ELIGIBLE/BOARD_VERSION_CHANGED: no insistir, iniciar nueva partida si quiere.
- Vista rankings loading/empty/error/list con foco/live regions, responsive y contenido renderizado textContent. Cancelar o ignorar fetch viejo cuando cambia combinación; clave de caché (si futura) incluye city,difficulty,versions,limit,offset, nunca datos de identidad.
- Mocks frontend solo en tests/inyección explícita del cliente HTTP, con shapes de sección 8, nunca fallback falso de éxito en producción. Probar primero mocks, luego QA real con backend. No consta ezdone en este repositorio: seguir DOM/CSS actuales sin añadir esa dependencia ni inventar su API.
- Backend entrega API y harness de mismo origen para QA, prueba persistencia tras reinicio y todas las carreras. UI entrega adaptadores y flujo clasificado completo, no solo el formulario final. Ambos deben incorporar este documento y OpenSpec en su worktree antes de editar código; no cerrar checkboxes de tareas del otro.

## 10. Pruebas de aceptación obligatorias

1. Práctica sigue funcionando sin API y no permite publicación. Progreso local previo no entra a ranked game.
2. Juego real autoritativo: completar todas las calles únicas, repetir respuesta/key sin sumar, pistas=5/no pista=10, errores/saltos sin progreso; cambiar nivel no mezcla puntos; reanudar tras reload.
3. Publicar owner válido crea nombre+submission+entrada; manipular score/city/difficulty/player devuelve 422; game_id ajeno devuelve 404 y no reserva nombre.
4. Canonicalización: Ana_7/ana_7/espacios ASCII equivalen; mismo jugador reutiliza, otro recibe 409; Unicode/tabs/corto/largo/reservados fallan. Nuevo nombre del mismo jugador falla LOCKED.
5. Dos sesiones distintas publican simultáneamente mismo nombre: exactamente una reserva; perdedor no deja submission. Dos marcas del mismo jugador: gana mejor, igual conserva anterior, no duplicados; rollback y restart comprobados.
6. Ranking solo combinación/version solicitada, sorted score/time/UUID, posiciones ordinales; páginas snapshot coherentes; vacío, offset mayor, query malformada y cambio de combinación con respuesta tardía.
7. Partidas incompletas, vencidas, abandonadas, dataset retirado, propietario falso: rechazo. Publicar partida válida ya registrada con otra key no duplica; mismo key/body reproduce; mismo key/distinto body falla.
8. Origin malicioso, cookie ausente/vencida, oversized JSON, rate limit, binding de loopback versus TLS producción, ninguna credencial en logs/respuestas públicas.
9. UI real Chromium: form, error de nombre ocupado, reintento tras timeout, doble clic, pérdida de sesión, lista vacía/error/carga, aislamiento ciudad/dificultad. QA con segunda ciudad fixture explícitamente sintética, nunca publicarla como dataset real.
10. Reinicio API preserva identidad/partidas/rankings/idempotencia. Migraciones dos veces seguras, FK activas, backup/restauración. Si se modifica empaquetado, smoke Docker y allowlist completa, fuentes/DB inaccesibles por HTTP.

## 11. Entrega y gates

Esta tarjeta entrega contrato documental; no implementa ni integra código. No hay SHA nuevo comprometido por esta tarea (sin autorización explícita de commit); archivos entregados desde su worktree y adjunto durable. Implementadores deben copiar/incorporar RANKINGS_SPEC.md y openspec/changes/add-city-difficulty-rankings antes de sus cambios, ejecutar openspec list/status y make openspec-validate CHANGE=add-city-difficulty-rankings. Especificación previa debe quedar trazable en su entrega a QA. No editar su contrato sin resolver divergencias en tarjetas.

No se modifica main ni se hace push/deploy. Implementadores entregan candidato exacto/base/pruebas y worktree limpio según AGENTS.md. QA revisa el candidato y la integración autorizada verifica main; cierre de esta fase de diseño solo libera las tarjetas existentes, no equivale a cerrar la entrega del sistema.
