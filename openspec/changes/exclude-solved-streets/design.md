## Context
Aplicación estática con reglas puras y controlador DOM. El dataset no incluye id de entidad; cada calle agrupa osm_way_ids. La selección previa excluye sólo la referencia anterior y el cambio de nivel reinicia todo el estado.

## Goals / Non-Goals
Registrar progreso único por dificultad, excluir aciertos y detener selección al agotar. Mantener puntuación, pistas, salto, normalización y GIS. No añadir persistencia, contador visible ni avance de nivel (t_89aabed0).

## Decisions
- streetId(street) retorna los osm_way_ids deduplicados, ordenados numéricamente y unidos por coma. Identidad estable para el dataset de la partida aunque cambien orden de array, objetos o nombres; no promete identidad frente a nuevas ediciones OSM. Validar IDs positivos enteros seguros no vacíos y unicidad de entidad al cargar.
- initialState(solvedByLevel = {}) incluye solvedByLevel como objeto de arrays de IDs, actualizado inmutablemente por updateState(state, event, street). Contexto opcional mantiene compatibilidad con consumidores previos que sólo prueban puntuación. Para correct con contexto, no sumar dos veces el mismo ID ni aun tras next.
- getProgress(streets, level, state) devuelve { correct, total, completed }, contando IDs únicos del dataset de ese nivel, sin contaminar otros niveles. Un nivel inexistente no se considera completado.
- selectStreet conserva sus cuatro argumentos actuales y añade solvedIds como quinto. Filtra aciertos por ID, evita repetición inmediata por ID si hay alternativa y devuelve null si el nivel existente está agotado; nivel inexistente sigue lanzando error.
- app pasa current a updateState, utiliza solvedByLevel al seleccionar y lo preserva al reiniciar puntos/racha por cambio de dificultad. Al agotarse: deshabilitar respuestas, ocultar Siguiente, quitar resaltado cuando se pide otra ronda y mostrar mensaje de completado. Sin avance automático; el último acierto sigue visible hasta abandonar esa ronda.

## Risks / Trade-offs
El progreso vive sólo en memoria y se reinicia al recargar. La identidad depende de los IDs OSM del dataset vigente. El archivo app.mjs será modificado también por la tarjeta UI secuencial: debe partir de estos commits. No hay migraciones ni rollback de datos.

## Validation
Unitarias con dataset real (15/13/145), clones e IDs reordenados, error/salto/pista, duplicados tras next, última pendiente, aislamiento y estado anterior inmutable. Chromium completa 15 calles sin repetición, verifica error/salto y regreso a nivel completado sin calle activa, y conserva las regresiones existentes. Gates OpenSpec, guard, npm test, sintaxis y diff limpio.
