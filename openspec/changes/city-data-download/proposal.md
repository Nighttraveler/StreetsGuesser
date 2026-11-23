## Why
La adquisición manual y las rutas fijas impiden reutilizar el flujo GIS para otra localidad compatible. t_480ed6ad acordó el contrato previo CITY_DOWNLOAD_SPEC.md; no existe aún una biblioteca de descarga.

## What Changes
- Biblioteca/CLI Python con configuración declarativa por ciudad, POST Overpass inyectable y errores tipados, sin retries ni publicación automática.
- Snapshots canónicos en data/arrecifes/, conservando bytes y copia pública raíz.
- Extractor offline parametrizado con staging y procedencia comprobable; conservar algoritmos y juego.
- Pruebas sin red de dos ciudades, errores, persistencia segura, reproducción y aislamiento HTTP.

## Capabilities
### New Capabilities
- `city-data-download`: adquisición y transformación offline configurable, con persistencia segura y compatibilidad del snapshot histórico.

### Modified Capabilities
Ninguna.

## Impact
Nuevos download_gis.py, test_download_gis.py, city.json; mover raw/derivados/queries; actualizar extract_gis.py, test_gis.py, tests/test_serve_static.py, GIS_README.md. Sin dependencias runtime nuevas ni API/UI/imagen nuevas. curl para adquisición; Shapely sólo transformación. No red durante migración ni cambios en producción.
