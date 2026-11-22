## Why
Durante una partida falta navegación directa con mouse. La tarjeta t_c065e516 solicita arrastre sin interferir con clics, controles ni rondas.

## What Changes
- Arrastre con botón principal exclusivamente sobre el SVG cargado, umbral de 5 píxeles CSS y actualización continua del viewBox.
- Conversión de desplazamiento de pantalla a coordenadas SVG respetando preserveAspectRatio y zoom. Cancelación al soltar fuera, perder foco, ocultar documento o detectar botón liberado.
- Supresión del clic asociado al arrastre, sin afectar clics normales ni controles. Cancelación de animaciones al empezar a desplazar.
- Pruebas unitarias, Chromium real y documentación de uso.

## Capabilities
### New Capabilities
- `mouse-map-navigation`: navegación por arrastre del mapa SVG.
### Modified Capabilities
Ninguna.

## Impact
app.mjs, game.mjs, styles.css, tests/game.test.mjs, tests/browser.test.mjs y APP_README.md. Sin dependencias, APIs, migraciones, datos GIS, empaquetado nuevo ni despliegue. Se conservan los cinco archivos publicables.
