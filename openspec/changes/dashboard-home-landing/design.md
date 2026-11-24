## Context
Rutas y allowlists existentes establecen / e /index.html como portada sin scripts, /play.html como juego completo. Se conserva ese contrato.

## Goals / Non-Goals
Meta: grilla densa pero legible, CTA claro y contenido honesto. No montar previews funcionales, consumir catálogos, cambiar reglas ni producir métricas artificiales.

## Decisions
- Documento HTML semántico: skip link, header/nav, main, secciones tituladas, lista de pasos, ficha descriptiva y footer con atribución OSM.
- CSS inline exclusivamente para portada; no ampliar allowlists ni tocar styles.css compartido. Sin fuentes externas ni imágenes remotas.
- Inspiración de popular-web-designs: superficies oscuras y etiquetas de Sentry, jerarquía compacta de Kraken, agrupación editorial de Cohere, bordes técnicos y CTA contrastado de ClickHouse. Paleta propia azul petróleo/lima existente. Nada de logos, métricas, gráficos de resultados o falsos estados en vivo.
- Motivo cartográfico CSS no interactivo, explícitamente rotulado como esquema ilustrativo y no mapa real. No SVG ni GIS ni controles del juego.
- Pasos: elegir dificultad, reconocer trazo, escribir nombre. Práctica local y clasificado condicionado al servidor. Catálogo permanece en ruta del juego.
- Grid minmax(0,...) y una columna en móvil, tamaño base 16px, foco de 3px, blancos táctiles de 44px. Sin ocultar overflow para simular ajuste.

## Risks / Trade-offs
CSS inline evita ampliar contrato Docker y mantiene independencia; no hay CSP actual que lo prohíba. No certifica Safari físico. Probar Chromium, tamaños 320/375/768/1280 y texto ampliado, navegación por Tab/Enter, entrada directa/recarga/retorno. Los tests existentes de práctica estática y rankings protegen la ruta no modificada.

## Verification
Gates OpenSpec, npm test, navegador de landing/rutas, práctica estática y funcional. Documentar resultados reales, hashes, límites y QA separada; no desplegar ni integrar main.
