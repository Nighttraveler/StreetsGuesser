## Context
Aplicación de HTML y módulos nativos sin build ni router. Dos servidores con allowlist: Python estático y composición Node de desarrollo con rankings. Las rutas raíz cargan hoy index.html con app.mjs.

## Goals / Non-Goals
Separar documento y ciclo de vida del juego; preservar práctica, catálogo y clasificado. No diseñar el landing final, cambiar lógica ni desplegar.

## Decisions
Usar /play.html, archivo raíz sin directorio: conserva todos los imports/fetch relativos existentes y funciona con servidores estáticos sin rewrite. Mover HTML completo sin alterar IDs. / y /index.html mostrarán documento mínimo sin módulo ni fetch, con enlace relativo ./play.html. Agregar retorno explícito ./index.html dentro del juego. Una navegación de documento completo elimina el contexto del juego; recargar inicia práctica nueva como antes.

La allowlist Python y COPY Docker crecen de cinco a seis activos. Node agrega solo /play.html; no fallback genérico. Pruebas de UI existentes pasan a /play.html conservando fixtures; se agrega una prueba específica de portada sin scripts/requests del juego, navegación, recarga y regreso en ambos servidores. Pruebas HTTP comparan bytes, GET/HEAD y 404 privados. Smoke Docker verifica nuevo contenido y juego en su URL.

## Risks / Trade-offs
Enlaces antiguos a / ahora muestran portada en lugar de juego, intencional. Despliegues externos deben copiar también play.html; no se actualizan producción ni systemd. Modo Python sigue sin rankings, con fallback de práctica existente. El catálogo se mantiene en juego para preservar selección contextual existente; landing futuro decidirá su contenido sin importar app.mjs.

## Verification
Gates OpenSpec, npm test, suites Playwright de juego/catálogo/rankings e integración, unittest HTTP y build/smoke Docker. Documentar evidencia real y limitaciones, no certificar teléfonos físicos.
