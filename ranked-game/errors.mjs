const definitions = {
  INVALID_JSON: [400, 'JSON inválido.'], INVALID_QUERY: [400, 'Consulta inválida.'],
  SESSION_REQUIRED: [401, 'Necesitás una sesión válida.'], ORIGIN_FORBIDDEN: [403, 'Origen no permitido.'],
  CITY_NOT_FOUND: [404, 'Ciudad no encontrada.'], BOARD_NOT_FOUND: [404, 'Clasificación no encontrada.'],
  GAME_NOT_FOUND: [404, 'Partida no encontrada.'], DATASET_NOT_FOUND: [404, 'Datos no encontrados.'], NOT_FOUND: [404, 'Ruta no encontrada.'],
  USERNAME_TAKEN: [409, 'Ese nombre ya está ocupado. Elegí otro.'], USERNAME_LOCKED: [409, 'Tu nombre no se puede cambiar.'],
  IDEMPOTENCY_CONFLICT: [409, 'La clave ya fue usada con otra solicitud.'], ACTIVE_GAME_EXISTS: [409, 'Ya tenés una partida activa.'],
  STALE_ROUND: [409, 'La ronda ya cambió.'], GAME_NOT_ACTIVE: [409, 'La partida no admite esa acción.'],
  GAME_NOT_ELIGIBLE: [409, 'La partida no es elegible para publicar.'], BOARD_VERSION_CHANGED: [409, 'La versión del tablero cambió.'],
  INVALID_USERNAME: [422, 'Usá entre 3 y 20 letras ASCII, números o guion bajo.'], USERNAME_RESERVED: [422, 'Ese nombre está reservado.'],
  UNKNOWN_FIELD: [422, 'Campo desconocido.'], INVALID_FIELD: [422, 'Campo inválido.'],
  IDEMPOTENCY_KEY_REQUIRED: [422, 'Se requiere una clave de idempotencia UUID v4.'],
  BODY_TOO_LARGE: [413, 'El cuerpo excede el límite permitido.'], UNSUPPORTED_MEDIA_TYPE: [415, 'Se requiere application/json.'],
  RATE_LIMITED: [429, 'Demasiadas solicitudes. Intentá más tarde.'], RETRY_LATER: [503, 'Servicio ocupado. Reintentá.'],
  INTERNAL_ERROR: [500, 'No se pudo completar la solicitud.'],
};
export class ApiError extends Error {
  constructor(code, field = null, retryAfter = null) {
    const [status, message] = definitions[code];
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
    this.retryAfter = retryAfter;
  }
  toJSON() { return { error: { code: this.code, message: this.message, field: this.field, retryable: [429, 503].includes(this.status) } }; }
}
export function fail(code, field = null) { throw new ApiError(code, field); }
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export const iso = value => value === null ? null : new Date(value).toISOString();
export function fields(body, allowed, required = allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('INVALID_FIELD');
  for (const key of Object.keys(body)) if (!allowed.includes(key)) fail('UNKNOWN_FIELD', key);
  for (const key of required) if (!Object.hasOwn(body, key)) fail('INVALID_FIELD', key);
}
