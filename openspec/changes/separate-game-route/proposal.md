## Why
La portada actual monta el juego y su lógica. El landing posterior necesita una entrada independiente sin cargar mapa, catálogo ni rankings.

## What Changes
- Mover la vista completa de juego a /play.html y dejar / e /index.html como portada mínima enlazada, sin scripts.
- Exponer play.html en los dos servidores allowlist y en Docker (seis activos, sin publicar el checkout).
- Adaptar pruebas existentes a la nueva URL y agregar aislamiento, navegación y recarga.
- Documentar URL y contrato de publicación. No modificar reglas, GIS ni API.

## Capabilities
### New Capabilities
- `dedicated-game-route`: entrada de juego estática independiente de la portada.
### Modified Capabilities

## Impact
index.html, nuevo play.html, serve_static.py, ranked-game/http.mjs, Dockerfile; tests HTTP, Playwright y smoke Compose; documentación. Sin nuevas dependencias o migraciones. El catálogo seleccionable permanece dentro de la vista del juego, no en la portada mínima. El landing visual se implementa en otra tarjeta.
