## 1. Especificación
- [x] Traducir COMPOSE_SPEC.md a propuesta, diseño y delta propio; plan publicado en Kanban.
- [x] Validar OpenSpec antes de editar rutas protegidas; este commit contiene solo la especificación.
- [x] Reespecificar el cambio sin Nginx por decisión del usuario, publicar el plan actualizado y validar antes de cambiar el runtime.

## 2. Implementación
- [x] Verificar digest versionado y crear contexto de lista permitida, imagen estática y lanzador Python.
- [x] Configurar Compose endurecido, interpolación sin secretos y documentación operativa y de corte/reversión.
- [x] Incorporar pruebas explícitas de configuración, HTTP, seguridad, navegador, ciclo de vida y rollback aislados.

## 3. Verificación y entrega
- [x] Ejecutar validadores OpenSpec, guard, regresión npm y navegador, diff-check y smoke real.
- [x] Instalar hooks, revisar índice, confirmar trailer único por commit protegido y entregar worktree limpio y evidencia a QA sin merge, push ni corte.

## Evidencia de ejecución (2026-11-20, variante sin Nginx)
- `make openspec-validate CHANGE=docker-compose-deployment`: válido; `openspec validate --all --strict --no-interactive`: 2 cambios aprobados.
- `make openspec-guard-test`: 7 pruebas aprobadas; `npm test`: 5 aprobadas; `npm run test:functional`: 4 aprobadas con su servidor efímero.
- `python3 -m unittest discover -s tests -p test_serve_static.py -v`: 4 aprobadas. `bash -n tests/compose-smoke.sh` y `git diff --check`: sin errores.
- `docker buildx imagetools inspect` de ambos tags Python confirma el índice `sha256:9ef1a599f863231c3d91e941389bfdc4a2d6070557243d54df1a4e57015b960e`, incluida arm64/v8.
- `SMOKE_SUBNET=10.254.90.0/29 bash tests/compose-smoke.sh 18090`: salida 0. Configuración default/LAN/ensayo, build automático sin la etiqueta local, healthy, PID 1 Python UID 100, sin Nginx/capacidades, raíz RO, tmpfs 16 MiB y cinco estáticos comprobados. La subred se verificó sin solapamiento antes de crearla.
- HTTP/Chromium contra el contenedor: 9 pruebas aprobadas, Chromium 151.0.7922.173, mapa de 407 segmentos, tres niveles y respuestas, MIME/HEAD/404/hash intactos y sin peticiones externas.
- Stop/start, reinicio automático por salida de PID 1, recreación y logs aprobados. Rollback save/load con configuración archivada y `--no-build`: imagen siguiente `sha256:fe71e65f0be88fd4ebe39d7245073e9a757666092fa89edc94763133ff5261c2` → original `sha256:cc1cc8e07a5ad1645ba0dfd42eae42b989400c1fbca0eb8fa4127e563a6506f4`, linux/arm64, contenido idéntico.
- Limpieza verificada: no quedan contenedores ni redes del proyecto smoke. La unidad legada conserva active/running/enabled y MainPID 1726631; no se modificaron su docroot ni los cinco originales del checkout.
- Límites: sin ensayo amd64, reboot del host ni corte/reversión real de systemd; estos últimos requieren ventana autorizada. Los pools IPv4 del daemon requieren la configuración de red adicional documentada en este host. QA independiente en t_0eb9d683 revisará también el gate 58144c1 y los commits previos de especificación.
- Implementación confirmada en `d3d64e9f8427fdd33a24e05f85d8de9d0b817a39`, rama `programador/t_d76dc2c6`, merge-base con main `21a497ca26e019d241a2a2bab4bec1aa9bbbfc9f`. Hook ejecutado y trailer único `OpenSpec-Change: docker-compose-deployment` comprobado; worktree limpio tras el commit. Este cierre documental se confirma por separado y la transición de Kanban entrega los hashes exactos a la QA hija.
