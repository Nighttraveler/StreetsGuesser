## Context

`rankings-ui.mjs` ya carga un único catálogo para la portada y el selector clasificado. La portada no distingue ciudades por nombre en su lógica y no tiene una acción por fila.

## Goals / Non-Goals

- Cada fila puede activarse con teclado o toque y vincula el ID exacto a la selección existente.
- No abrir una ruta nueva, almacenar preferencias, ni iniciar/abandonar automáticamente una partida.

## Decisions

- Usar un botón nativo por entrada y guardar el ID recibido en `data-city-id`. El nombre se escribe como texto puro. El botón ocupa la tarjeta y conserva el estilo de foco global y la altura táctil de 44 px como mínimo.
- Al activar el botón se actualiza el selector de ciudad existente. Si el ID cambió, se reutiliza la lógica que prepara dificultades y refresca la clasificación; si es el mismo, se conserva la dificultad seleccionada.
- El foco se mueve a dificultad (o a ciudad cuando no hay dificultades), para que el siguiente paso quede a la vista. La operación no crea una sesión ni cambia el juego de práctica.

## Risks / Trade-offs

- Ir directamente al panel clasificado desplaza la página por diseño. Se usa foco nativo sin depender de animación o redirección.
