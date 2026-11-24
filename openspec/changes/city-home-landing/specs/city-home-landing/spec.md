## ADDED Requirements

### Requirement: Portada basada en el catálogo existente
La raíz / y /index.html SHALL presentar antes del juego una sección identificable Ciudades disponibles. SHALL mostrar una fila por ciudad devuelta por GET /api/v1/catalog, usando su nombre exacto, sin datos hardcodeados, filtros adicionales ni ampliación de permisos. SHALL reutilizar el cliente same-origin y la carga del catálogo de rankings.

#### Scenario: Catálogo real con varias ciudades
- **WHEN** la consulta inicial devuelve dos ciudades registradas
- **THEN** la portada muestra ambos nombres en el orden de la fuente y los mismos nombres del selector existente
- **AND** visitar la portada no crea sesión ni partida

### Requirement: Estados honestos y recuperación
La portada SHALL distinguir carga, lista disponible, lista vacía confirmada y fallo. SHALL consultar automáticamente al montar, tener región accesible de estado y permitir reintento cuando el servicio está disponible. Una respuesta malformada SHALL tratarse como error. No SHALL conservar una lista antigua como si fuera una respuesta actual tras fallo.

#### Scenario: Consulta pendiente
- **WHEN** el catálogo no ha respondido
- **THEN** se anuncia Cargando ciudades y no se muestra vacío ni una lista anterior
- **AND** reintentos simultáneos están deshabilitados

#### Scenario: Vacío confirmado
- **WHEN** responde con cities vacío
- **THEN** muestra No hay ciudades disponibles y ninguna fila

#### Scenario: Error y recuperación
- **WHEN** falla HTTP, red o validación del contrato
- **THEN** anuncia No se pudieron cargar las ciudades, sin mensaje vacío ni filas obsoletas
- **AND** un reintento exitoso muestra los nombres reales de la nueva respuesta

#### Scenario: Servidor estático sin módulos opcionales
- **WHEN** el módulo de rankings no está publicado
- **THEN** la portada anuncia catálogo no disponible sin inventar nombres ni solicitar API
- **AND** el mapa y una ronda de práctica siguen funcionando

### Requirement: Listado seguro, legible y accesible
El listado SHALL usar elementos semánticos y texto sin interpretar HTML. SHALL ser legible sin desbordamiento horizontal a 375 y 1280 píxeles, incluso con nombres largos. SHALL conservar el estilo y foco visible del proyecto.

#### Scenario: Nombres largos o con marcado
- **WHEN** el catálogo contiene nombres largos y texto con etiquetas HTML
- **THEN** todos los nombres se muestran completos como texto, sin ejecutar etiquetas
- **AND** la lista se ajusta en móvil y escritorio sin desbordar
