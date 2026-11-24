## Context
SVG #map en index.html compartido por práctica y clasificado; app.mjs usa mousedown/mousemove y panView con inversa getScreenCTM. Sin biblioteca de mapas. Encabezado tiene pointer-events:none; controles y pie son hermanos, no interceptan el centro. Falta input táctil y touch-action local.

## Goals / Non-Goals
Habilitar un dedo sin scroll de página iniciado en el SVG; conservar mouse, controles, ronda y scroll exterior. No añadir pinch zoom de cámara, rueda, límites de posición ni refactorizar rankings.

## Decisions
Mantener ruta mouse para evitar regresiones y añadir Pointer Events no-mouse usando el mismo estado/transformación. Capturar el puntero en SVG. Segundo dedo detiene pan hasta nuevo gesto; pointercancel/lostpointercapture/blur/hidden y comandos limpian estado. No preventDefault global ni touch listeners no pasivos. CSS touch-action:pinch-zoom sólo en #map permite al navegador tomar el gesto de dos dedos y evita pan nativo de uno. Liberar captura al limpiar. Umbral de 5px y supresión de clic post-drag existentes se mantienen; pointerdown nuevo limpia supresión.

## Risks / Trade-offs
Zoom de página depende del navegador; la verificación Chromium emulada no certifica Safari/iOS físico. QA hija revisa plataformas. No se deshabilita zoom con viewport. Mantener mouse separado reduce riesgo, a costa de dos entradas que comparten función de movimiento.

## Verification
Añadir test CDP touchStart/touchMove/touchEnd antes de implementación y observar RED. Comprobar cámara continua en ambas direcciones/ejes, escala constante, scroll exterior real, taps de controles, cancelación y nuevo gesto. Prueba pinch nativo con visualViewport.scale, sin reclamar pinch de cámara. Regresión funcional completa, npm test y gates OpenSpec. Sin build frontend por ser estáticos; Docker no cambia.
