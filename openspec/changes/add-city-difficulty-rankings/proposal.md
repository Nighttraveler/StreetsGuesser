## Why

Los jugadores necesitan comparar resultados por ciudad y dificultad. Hoy el juego es estático y no tiene identidad ni partidas verificadas; un formulario que publique puntos del navegador permitiría falsificar resultados.

## What Changes

- Añadir modo clasificatorio online optativo con identidad anónima persistente y partidas autoritativas, sin convertir progreso local previo en resultados válidos.
- Crear módulo independiente de rankings con nombres únicos globales, un mejor resultado por jugador y clasificación por ciudad/dificultad.
- Definir API v1, persistencia SQLite, concurrencia, errores y estados UI en RANKINGS_SPEC.md antes de implementar.
- Conservar práctica local existente. La publicación requiere consentimiento explícito mediante formulario.
- Planificar servicio API separado bajo el mismo origen; no desplegar ni modificar systemd en esta tarea.

## Capabilities

### New Capabilities

- `city-difficulty-rankings`: identidad, partidas verificadas, publicación y consulta de rankings.

### Modified Capabilities

Ninguna: el modo local conserva sus reglas; el modo clasificatorio es nuevo.

## Impact

Implementación futura en rankings/, ranked-game/ y módulo frontend dedicado; integración acotada en app.mjs, index.html y styles.css. SQLite persistente y servicio Node con acceso al módulo puro game.mjs. Cambios de empaquetado/allowlist y topología requieren validación Docker posterior. Esta entrega contiene únicamente diseño y OpenSpec; no afirma que existan backend, migraciones ni despliegue.
