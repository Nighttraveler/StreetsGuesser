## Why

La revisión de la portada detectó que las ciudades se mostraban como texto y no se podían activar. El contrato de la tarea pide una acción por ciudad que conserve el identificador del catálogo, incluso si dos ciudades comparten nombre.

## What Changes

- Convertir las filas del catálogo de la portada en botones accesibles que seleccionen esa ciudad en el panel clasificado.
- Llevar el foco al selector de dificultad o, si no hay dificultades, al selector de ciudad sin iniciar una partida.

## Capabilities

### New Capabilities

- `home-city-selection`: selección de una ciudad del catálogo desde la portada.

### Modified Capabilities

Ninguna.

## Impact

Portada, selección clasificada y pruebas de navegador. Sin cambios de API, registro de ciudades, sesiones, práctica estática ni infraestructura.
