## Context

El import estático de rankings-ui.mjs hace fallar la evaluación de app.mjs cuando el servidor de cinco activos devuelve 404. La práctica ya tiene lógica y datos locales; rankings usa callbacks y solo se activa por controles explícitos.

## Goals / Non-Goals

Goals: arranque local independiente, error opcional capturado y visible, rankings intacto cuando los módulos están presentes; prueba contra servidor real y política HTTP original.
Non-goals: publicar nuevos activos, activar API en Docker, alterar rankings o GIS, desplegar o modificar systemd.

## Decisions

Importar rankings dinámicamente en una tarea independiente, sin esperar esa tarea para registrar listeners ni cargar el mapa local. Montar los callbacks existentes solo al resolver el import. En caso de fallo indicar clasificado no disponible en su panel y deshabilitar su control de carga; no sobrescribir feedback/progreso de práctica. No puede existir rankedView antes del montaje exitoso.

La regresión Node/Playwright iniciará StaticServer importado del serve_static.py del propio worktree en loopback/puerto efímero. Copiará exclusivamente los cinco activos declarados por COPY en Dockerfile a un directorio temporal; no usará un servidor sustituto ni servirá módulos extra. Comprobará 404 de módulos/API/rutas privadas, mapa SVG, input habilitado, respuesta correcta, score/progreso y ausencia de excepciones JS. Los 404 opcionales de red son esperados, no excepciones JS aceptables.

## Risks / Trade-offs

La interfaz clasificada se monta asíncronamente; las pruebas Node existentes y E2E real deben conservar su uso tras habilitar práctica. El navegador puede registrar un 404 opcional en consola en modo estático; se acepta, no un rechazo sin manejar. Docker no se reconstruye porque su contrato/configuración no cambia: la prueba reproduce sus cinco activos con el servidor real.

## Verification

Commit documental previo; RED contra candidato base antes del cambio app; GREEN con corrección. npm test, npm run test:functional, cliente/interfaz y E2E con SQLite local sin RANKINGS_BACKEND_ROOT, pruebas Python HTTP y gates OpenSpec (incluido rango desde ee398b4). Candidato limpio, ancestros preservados, revisión independiente posterior.
