## Context
Contrato completo previo: CITY_DOWNLOAD_SPEC.md (t_480ed6ad), incorporado sin alterar sus decisiones. Baseline ead38d0; hashes registrados allí y confirmados antes de implementar.

## Goals / Non-Goals
Reutilizar adquisición y almacenamiento por ciudad conservando salida, fallos visibles y HTTP público. No cambiar topología soportada, clasificación, juego, despliegue ni activar otra ciudad real.

## Decisions
- CityConfig/DownloadOptions/OverpassRequest/DownloadResult dataclasses, DownloadError estable. Validación estricta de config incluso instanciada directamente antes de red. Directorio data/<slug>/city.json, cinco campos exactos sin duplicados; slug seguro, relación positiva y coordenadas finitas válidas.
- Query única byte-idéntica al baseline para Arrecifes. curl por argv/stdin, POST data URL encoded, sin shell, redirects o retry. Defaults y códigos según contrato secciones 4-5; capturar headers/status en temporales privados sin mezclarlos con raw. No loguear fuente ni stderr remoto completo.
- JSON estricto UTF-8 sin no-finitos; conservar bytes/OSM; comprobar relación y vías mínimas, dejando GIS detallado offline.
- CLI --city obligatorio, --output-dir nuevo y fuera de data canónica; ningún overwrite. Validar antes de crear; limpiar sólo staging propio en fallo. Guardar query/source exactos y acquisition.json con endpoint, city_slug, source_sha256, query_file. Sin promoción.
- Mover snapshots sin reserializar. Copia pública regular raíz idéntica. boundary parametrizado sin defaults; build intacto. Wrapper offline por defecto Arrecifes, --city y --input-dir; sidecar validado en staging, sin sidecar sólo histórico canónico con hash conocido. Preparar derivados temporales antes de reemplazar; sólo Arrecifes canónico actualiza copia pública después de validar todos los niveles.
- Transporte y errores inyectables prueban dos ciudades y fallos sin red; pruebas reales curl simulando proceso, CLI y filesystem; reproducción temporal GIS y servidor denylist verifican invariantes.

## Risks / Trade-offs
Varias sustituciones de derivados no son una transacción filesystem conjunta; preparación completa evita publicación por errores de transformación/escritura inicial, y cada replace es atómico. No se promete rollback ante corte durante replace. curl externo puede no existir: fallo tipado transport. Snapshot histórico se permite sólo con hash conocido; staging exige procedencia explícita.

## Migration Plan
Mover raw, límite, metadata y queries a data/arrecifes; copiar calles canónico desde público. Registrar/verificar SHA-256 antes/después y reproducción exacta de los tres derivados. Mantener archivos de evidencia históricos intactos. Sin descarga ni despliegue. QA revisa commits exactos antes de integración.

## Open Questions
Ninguna; futuras topologías/proveedores/selector UI quedan fuera.
