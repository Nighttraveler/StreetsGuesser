## Why
El juego necesita un artefacto reproducible e independiente de la unidad systemd heredada. COMPOSE_SPEC.md define el contrato técnico; esta entrega no realiza el corte.

## What Changes
- Empaquetar solo los cinco estáticos aprobados. Por decisión posterior del usuario (COMPOSE_SPEC.md §7), usar Python Alpine oficial fijado por versión y digest, biblioteca estándar, sin Nginx ni proxy.
- Proporcionar Compose endurecido, healthcheck HTTP y configuración local sin secretos.
- Entregar pruebas de despliegue y guía de operación, respaldo, migración y rollback offline.

## Capabilities
### New Capabilities
- `static-compose-deployment`: publica y opera el juego intacto con Docker Compose.

### Modified Capabilities
Ninguna.

## Impact
Dockerfile, compose.yaml, serve_static.py, .dockerignore, .env.example, DEPLOYMENT.md y pruebas de despliegue. No cambia GIS, lógica, permisos del host, unidad heredada ni docroot activo. QA revisará también el gate de gobernanza separado, todavía fuera de main.
