## Context
El controlador ya consume getProgress y conserva solvedByLevel; los niveles están configurados como opciones ordenadas del selector. No duplicar contadores ni inferir progreso de puntos.

## Goals / Non-Goals
Contador accesible, avance voluntario y restauración por nivel. No persistencia, nuevas reglas de puntuación, GIS ni despliegue.

## Decisions
- Contador separado bajo la dificultad, región live polite/atomic con etiqueta acertadas/total. Antes de cargar permanece oculto para no presentar un total ficticio.
- Helper puro nextLevel(level, configuredLevels): siguiente elemento de la configuración, null al final o ante nivel desconocido; no sumar 1 ni volver al primero.
- El controlador deriva las opciones habilitadas del selector. Al completar muestra botón con nombre del destino; foco al botón o al selector si no hay destino. El último acierto sigue visible y no se elige otra calle.
- Aceptar comprueba nuevamente completitud y destino, selecciona nivel y reutiliza el reinicio de marcadores/selección existente, conservando solvedByLevel. Foco a respuesta si hay calle; en nivel agotado, a oferta o selector. No es necesario rechazar: el jugador puede permanecer sin pulsar o elegir dificultad manualmente.
- Al volver a un nivel agotado, mantener contador y oferta válidos sin calle activa. Nivel máximo anuncia completado sin botón.

## Risks / Trade-offs
Progreso sólo en memoria. Mantener mensajes existentes y estilos reutilizados reduce cambios. Chromium móvil no sustituye dispositivos físicos.

## Verification
Unitarias helper con niveles consecutivos/no consecutivos/desconocido/vacío. Chromium real 0/15 a 15/15, error/salto/pista/doble envío, no avance automático, aceptación a progreso medio existente, retorno completado y máximo sin oferta. Gates OpenSpec, guard, unitarias, GIS, sintaxis y diff; sin build frontend (estáticos) ni build Docker al no modificar empaquetado.
