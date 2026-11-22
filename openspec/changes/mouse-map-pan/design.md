## Context
El mapa usa viewBox con xMidYMid meet; zoomTo anima 650 ms. changeZoom limita ancho pero no existen límites x/y de cámara. No hay acción de clic en el SVG. Controles HTML son hermanos superpuestos del SVG.

## Goals / Non-Goals
Navegación continua con mouse y conservación de juego, dimensiones y límites de zoom. No agregar límites posicionales inexistentes, gestos táctiles, rueda, selección de calles ni dependencias.

## Decisions
- Eventos mouse: mousedown en SVG, mousemove/mouseup en window para salida del mapa. Solo button 0; excluir controles interactivos mediante closest. No capturar ni impedir el clic antes del umbral.
- Estado pendiente desde posición inicial; umbral euclidiano de 5 px CSS. Al cruzarlo cancelar requestAnimationFrame y tomar vista actual. Transformar delta usando la parte lineal de getScreenCTM().inverse() (sin traslación): cubre letterboxing y escala real; conservar ancho/alto.
- Aplicar delta incremental desde la última posición, incluyendo delta inicial al superar umbral. Cursor grab/grabbing y evitar selección nativa solo en mapa.
- Cancelar gesto en mouseup global, blur, documento oculto, mousemove sin buttons&1, y antes de zoom/nueva ronda. Suprimir solamente el clic de mouse resultante de un arrastre usando captura en SVG; limpiar supresión al próximo mousedown, incluso sobre controles. Sin temporizador arbitrario. Clics de teclado no se suprimen.
- Funciones puras en game.mjs para umbral y transformación, sin ampliar whitelist del servidor o Docker.

## Risks
Los eventos fuera de la ventana pueden perder mouseup: blur y comprobación buttons evitan arrastre pegado al volver. Pruebas reales validan que la animación no sobrescriba el desplazamiento. El soporte táctil permanece sin cambios.

## Validation
Unitarias para umbral y transformación, incluyendo matriz no trivial y tamaños inmutables. Chromium para ambos ejes, movimiento continuo y escala/letterboxing, clic simple y posterior al arrastre, botones secundarios, controles, salida, blur/ocultación y animación. Gates locales de OpenSpec, hook, npm test y regresión funcional. Sin cambios Docker: no requiere build nuevo de infraestructura.
