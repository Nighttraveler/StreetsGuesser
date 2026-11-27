## 1. Implementación

- [x] 1.1 Empaquetar web y API en una imagen Node con arranque local autónomo y volumen.
- [x] 1.2 Asegurar el listener local y permitir el modo HTTPS detrás de un proxy configurado aparte.
- [x] 1.3 Documentar arranque, respaldo, restauración y reversión.

## 2. Verificación

- [x] 2.1 Validar build, seguridad, práctica y ranking en Compose real.
- [x] 2.2 Verificar sesión y marca tras recreación, además de respaldo y restauración.
- [x] 2.3 Ejecutar gates, inspeccionar el diff y entregar candidato limpio a QA.

## Evidencia del candidato

- Build y smoke reales en Linux ARM64 con Node 22.22.3 y Chromium 151.0.7922.173. Las 13 pruebas HTTP/Chromium pasaron en el puerto 18090, incluida una partida completa con publicación en el tablero de dificultad 1 y separación de dificultad 2.
- El ensayo conservó la sesión y la marca después de recrear el servicio. La restauración desde el respaldo SQLite y los snapshots en un segundo volumen conservó la misma sesión y marca.
- Los proyectos, volúmenes y etiqueta temporales se retiraron. El contenedor estático activo en 8090 quedó operativo.
