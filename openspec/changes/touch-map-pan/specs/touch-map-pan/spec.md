## ADDED Requirements
### Requirement: Arrastre de un dedo
El mapa SVG SHALL seguir un dedo de forma continua en cualquier dirección al superar 5 píxeles, sin cambiar escala de cámara, ronda ni puntos.

#### Scenario: Desplazamiento continuo
- **WHEN** un dedo inicia dentro del mapa cargado y se mueve horizontal, vertical y diagonalmente
- **THEN** la cámara se traslada con la inversa de la transformación SVG y no desplaza la página

### Requirement: Frontera local de gestos
La aplicación SHALL limitar la captura de pan táctil al SVG y SHALL conservar scroll fuera del mapa, controles, mouse y zoom nativo de página.

#### Scenario: Scroll exterior
- **WHEN** el usuario desliza fuera del SVG
- **THEN** la página puede desplazarse normalmente

#### Scenario: Controles y zoom
- **WHEN** el usuario pulsa controles, arrastra con mouse o hace pinch nativo
- **THEN** los controles y mouse mantienen comportamiento y el navegador puede ampliar la página sin pan de cámara de dos dedos

### Requirement: Fin y cancelación
La aplicación SHALL detener el arrastre al soltar, cancelar, perder captura/foco, ocultar documento, agregar otro dedo o ejecutar un comando de cámara.

#### Scenario: Recuperación
- **WHEN** un gesto termina o se interrumpe
- **THEN** movimientos posteriores no alteran la cámara y un gesto nuevo de un dedo vuelve a funcionar sin saltos
