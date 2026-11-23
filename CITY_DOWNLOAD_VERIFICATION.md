# Verificación de city-data-download — t_84499d2c

Fase de implementación lista para QA hija t_aafa5409. No es aprobación, integración ni despliegue.

## Identidad del candidato

- Worktree: /home/fer/projects/StreetGuesser/.worktrees/t_84499d2c
- Rama: wt/t_84499d2c
- Base común con main: ead38d0654beeed77720ccc464169286da250c5a
- Especificación previa: 87670285a6beb560cb13deaf7804632e4e5e026d (CITY_DOWNLOAD_SPEC.md y OpenSpec city-data-download), validada antes de crear código/config/tests.
- Implementación: ff3711dcd8067917b201843df0bbdfc2af3eae1c, exactamente un trailer OpenSpec-Change: city-data-download; hook ejecutado sin bypass.
- El commit documental que contiene este informe es el cierre de evidencia; el handoff Kanban identifica su SHA exacto y el candidato final.

## Cambios

Nuevos: download_gis.py, test_download_gis.py, data/arrecifes/city.json, data/arrecifes/calles.json (copia canónica idéntica al público), documentación de contrato/OpenSpec y este informe.
Modificados: extract_gis.py, test_gis.py, tests/test_serve_static.py, GIS_README.md.
Renombres 100% idénticos: discover-retry.json, discover.json, discover.overpassql, extract.overpassql, verify-area.json y verify-area.overpassql desde raíz a data/arrecifes/; arrecifes_source.json a data/arrecifes/source.json; arrecifes_limite.geojson a data/arrecifes/limite.geojson; arrecifes_metadata.json a data/arrecifes/metadata.json.
No hay eliminaciones de datos. No se modifican app.mjs, game.mjs, URL pública, allowlist, Dockerfile, compose.yaml ni archivos de producción.

## Ejecuciones y resultados reales

- RED inicial: python3 -m unittest test_download_gis -v falló por módulo aún inexistente antes de implementar.
- python3 -m unittest test_download_gis -v: 11/11 OK. Dos ciudades/respuestas simuladas, solicitud y bytes/hash, configuración y opciones inválidas antes de red, JSON/remark/esquema/relación erróneos, curl flags/status/errores, CLI éxito/error, fallos de escritura y carrera de staging. Subproceso CLI real fuera del cwd con PATH vacío verifica curl ausente sin tocar red.
- uv run test_gis.py: 16/16 OK (11 existentes + reproducción/migración, procedencia, segunda ciudad sintética, preparación fallida e invariancia ante niveles incompletos). Reproducción en temporales, sin alterar canónicos.
- uv run extract_gis.py: exit 0, regeneración real offline con 173 entidades, 407 segmentos, niveles 15/13/145 y hashes baseline idénticos para fuente, calles, límite y metadata (CITY_DOWNLOAD_SPEC.md sección 10). Copia pública regular idéntica a data/arrecifes/calles.json.
- python3 -m unittest discover -s tests -v: 22/22 OK (7 guard, 11 CI, 4 HTTP). /data/arrecifes/source.json y /data/arrecifes/city.json devuelven 404.
- npm test: 14/14 OK.
- npm run test:functional: 12/12 OK en Chromium real; incluye carga y errores de carga con reintento recuperable. Sin servicios externos.
- make openspec-validate CHANGE=city-data-download: OK antes de implementación y antes del commit.
- openspec validate --all --strict --no-interactive: 8/8 OK.
- make openspec-guard-test: 7/7 OK.
- make openspec-ci-validate BASE=ead38d0654beeed77720ccc464169286da250c5a HEAD=HEAD: OK sobre ff3711d, valida único commit protegido y validación global.
- git diff --check y git diff --cached --check: OK; diff staged completo inspeccionado, copias/renombres verificados sin reserialización. Hook instalado por make install-hooks. Worktree limpio después del commit de implementación.
- Búsqueda de 3743598/coordenadas antiguas en Python común: sin constantes de identidad GIS. Excepciones deliberadas: User-Agent histórico centralizado y wrapper/procedencia histórica/público Arrecifes en extractor; configuración y fixtures específicos. build/LEVEL y los checks geométricos originales permanecen iguales.

## Smoke Docker adicional y pendiente operativo

Primera invocación directa de node --test tests/compose.test.mjs falló 9/9 por conexión rechazada porque no había servidor en su puerto predeterminado. No fue fallo del código de adquisición. Se corrigió el procedimiento: docker build -t streetguesser:test-t84499d2c . y contenedor aislado en 127.0.0.1:18094, read-only, sin capacidades y no-new-privileges. Readiness comprobada con curl. COMPOSE_SMOKE_ORIGIN=http://127.0.0.1:18094 node --test tests/compose.test.mjs pasó 9/9, incluido Chromium 151.0.7922.173. curl confirmó raw/config 404 también en imagen. No se ejecutó el script completo compose-smoke.sh ni se certifica su modelo de redes actual; no se cambiaron sus supuestos/configuración fuera de alcance.

El entorno headless denegó docker stop/rm. No se eludió la denegación. Recurso residual verificado y tarea operativa bloqueada t_bd914bfc para limpieza autorizada:

- Contenedor streetguesser-test-t84499d2c, ID 9fa89528d9e9f1e9f898bec244e3579c080351b325674687b0b3e83a356cc1c6, sólo loopback 18094.
- Imagen streetguesser:test-t84499d2c, sha256:2aebaefb4bfafa15ec640c92914ea209d7a39fa4cb5791582d92f198fcbdfbe9.

## Límites

Sin peticiones Overpass reales ni nueva ciudad de producción. La segunda ciudad es fixture explícito, nunca datos publicables. La promoción de staging es manual y fuera de alcance. Se conserva topología soportada y obligación de tres niveles no vacíos; no es un buscador mundial. Los derivados se preparan todos antes de reemplazar; cada replace es atómico, pero no hay transacción conjunta/rollback ante corte durante múltiples reemplazos. QA e integración a main siguen pendientes.
