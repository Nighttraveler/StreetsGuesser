## Why
El mapa SVG de la vista de juego sólo procesa mouse; un dedo desplaza la página en vez de la cámara.

## What Changes
- Arrastre continuo táctil de un dedo en cualquier dirección, con umbral y coordenadas SVG.
- Política de gestos local al mapa; scroll exterior y pinch zoom nativo de página conservados.
- Cancelación robusta al soltar, perder captura/foco, segundo dedo y comandos de cámara.
- Pruebas de navegador táctil, regresión mouse y guía reproducible.

## Capabilities
### New Capabilities
- `touch-map-pan`: navegación táctil del mapa SVG.
### Modified Capabilities
Ninguna; el contrato mouse existente se conserva.

## Impact
app.mjs, styles.css, tests/browser.test.mjs y APP_README.md. Sin API, migraciones, dependencias nuevas, GIS ni infraestructura. No existe pinch zoom de cámara previo: se preserva el zoom nativo de página y los botones.
