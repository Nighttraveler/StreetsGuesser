## Context
matchesAnswer compara nombres normalizados y originales; un alias explícito mantiene Merlassino. No existe búsqueda global: la respuesta se compara con el registro activo. Hay tres rutas reales: Ex-Ruta Nacional 8, Ruta Provincial 51 y Ruta Provincial 191.

## Decisions
Añadir una rama local a matchesAnswer tras la comparación existente. El alias de respuesta debe coincidir íntegramente con `ruta N` o `ex ruta N` (también ex-ruta N), después de normalizeName. Extraer el número de nombres normalizados completos con forma `(ex[- ] opcional) ruta (nacional/provincial opcional) N`. Comparar strings numéricos completos sin coerción, prefijos ni includes. No generalizar la eliminación de palabras de otras calles ni aceptar un número solo. Una respuesta larga conserva la comparación actual: no confundir nacional con provincial. Aplicar a nombres_originales también.

Mantener normalizeName sin cambios preserva pistas y comportamiento de calles. No alterar dataset, nombres visibles, identidad, estado, UI o GIS.

## Risks
Dos rutas con el mismo número pueden compartir alias corto; como el juego valida solamente la ruta activa, no se introduce un resolvedor global ni se unifican registros. No aceptar calificadores desconocidos ni formatos arbitrarios sin contrato.

## Verification
Pruebas unitarias reales para 8/51/191 y sintéticas para otros números y fuentes originales, invariancia de registro, negativos de 80/510, texto adicional y otras calles. Chromium envía alias por Enter a cada ruta real y verifica puntuación y nombre canónico. Ejecutar suites completas y gates OpenSpec/Git antes del commit.
