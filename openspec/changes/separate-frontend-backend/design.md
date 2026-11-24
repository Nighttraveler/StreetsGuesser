## Context

Mapa aprobado t_1b760997 y baseline QA t_f5a946ae sobre eef9290713a13c229c2075130468adec7625fda9. COMPOSE_SPEC.md secciones 5 y 7 más actualización de seis activos definen la imagen Python; sus descripciones históricas de Compose no sustituyen compose.yaml vigente (bind 0.0.0.0 y red externa proxy).

## Goals / Non-Goals

Separar ubicaciones y mantener comportamiento. No cambiar reglas, API, scoring, ranking, persistencia, SQL, configuración Compose, topología, systemd ni docroot externo. No regenerar GIS ni descargar datos.

## Decisions

1. frontend/ contiene index.html, play.html, styles.css, app.mjs, game.mjs, rankings-ui.mjs, ranked-game-client.mjs y arrecifes_calles.json. backend/ contiene ranked-game/ con migrations/, rankings/ y serve_static.py. El backend importa ../../frontend/game.mjs: un único módulo puro, sin paquete shared nuevo.
2. Node usa ../../frontend/ solamente en desarrollo y el mismo JSON de ese directorio para registro. Imports internos y SQL relativo se conservan. start:rankings y backup cambian rutas, no opciones ni entorno.
3. data/ conserva fuentes crudas, configuración, consultas y derivados canónicos. El extractor modifica únicamente su ruta de copia pública a frontend/arrecifes_calles.json; copia regular idéntica a data/arrecifes/calles.json. Estado SQLite/snapshots/backups privados permanecen externos.
4. Imagen conserva entrypoint /srv/arrecifes/serve_static.py y public/ adyacente. COPY explícito de seis frontend/* y backend/serve_static.py. .dockerignore niega ** y habilita traversal de frontend/ y backend/ y solo siete fuentes concretas. No se agregan módulos rankings a Python ni prefijos HTTP.
5. Pruebas separan repoRoot de frontendRoot, sin mover test-results/ ni tooling. Integración local usa backend/ranked-game/http.mjs y override conserva raíz que contiene ranked-game/. Ausencia del backend local debe fallar, no producir skip silencioso. Static-practice deriva basenames de COPY y copia desde fuentes reales.
6. Documentación activa explica comandos desde raíz, publicación por basename, respaldo de estructura frontend/backend y diferencias históricas de Compose. No reescribir informes históricos como evidencia nueva.

## Risks / Trade-offs

Imports y fixtures pueden omitir una ruta; cubrir con suites completas y regresión explícita. Backend depende del módulo puro en frontend: costo aceptado por arquitectura para evitar duplicación. Docker debe probarse aislado sin utilizar el runner Compose heredado incompatible ni alterar red proxy/servicios; build y docker run loopback con las mismas restricciones permiten smoke. No se certifica despliegue productivo.

## Migration Plan

Commit documental validado previo; después renombres y ajustes de referencias. Dataset SHA-256 ed1b5540bd2df7e3e98534675857ddcc2ebef21b0801a2ced47eaf6677567c5e y SQL SHA-256 2c68d64918ddd216258ffae54a1f5c905da34b603e1e3ed27b7f21d5ce43d8b6 intactos. Sin migración DB ni cambio de esquema. Entrega limpia con commits exactos a QA hija; QA/integrador realizan integración posterior.

## Validation

Gates AGENTS, npm test, functional, rankings/client/UI/city-home/static-practice e integración sin override y con backend/ como override; Python HTTP/GIS/descarga/guard/CI; coverage vigente; node --check; compose config, docker build y smoke HTTP/Chromium aislado; hashes y diff de SQL/data/Compose/reglas. No reducir umbrales ni expectativas funcionales.
