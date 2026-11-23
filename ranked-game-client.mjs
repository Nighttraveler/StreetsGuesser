// Same-origin only. Cookies remain HttpOnly; this adapter never stores credentials.
export class ApiError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}
export function createRankedClient(fetcher = globalThis.fetch.bind(globalThis), uuid = () => crypto.randomUUID()) {
  const intents = new Map();
  async function request(path, body, keyed = true) {
    const fingerprint = JSON.stringify([path, body]);
    const key = body !== undefined && keyed ? (intents.get(fingerprint) || uuid()) : null;
    if (key) intents.set(fingerprint, key);
    try {
      const response = await fetcher(`/api/v1${path}`, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
        signal: AbortSignal.timeout(15000),
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      let data;
      try { data = await response.json(); } catch { throw new ApiError('TRANSPORT', 'El servidor no devolvió una respuesta válida. Reintentá o seguí practicando.', true); }
      if (!response.ok) throw new ApiError(data.error?.code || 'HTTP_ERROR', data.error?.message || 'No se pudo completar la solicitud.', data.error?.retryable === true);
      intents.delete(fingerprint);
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        if (!error.retryable) intents.delete(fingerprint);
        throw error;
      }
      throw new ApiError('TRANSPORT', 'No se pudo conectar. Reintentá la misma operación; no confirmamos que se haya guardado.', true);
    }
  }
  return {
    catalog: () => request('/catalog'),
    session: () => request('/session'),
    startSession: () => request('/session', {}, false),
    active: () => request('/games/active'),
    game: id => request(`/games/${encodeURIComponent(id)}`),
    start: (city_id, difficulty) => request('/games', { city_id, difficulty }),
    dataset: game => request(`/cities/${encodeURIComponent(game.city_id)}/datasets/${encodeURIComponent(game.dataset_version)}`),
    action: (game, type, answer) => request(`/games/${game.id}/actions`, { round_id: game.round.id, type, ...(type === 'answer' ? { answer } : {}) }),
    abandon: game => request(`/games/${game.id}/abandon`, {}),
    submit: (game_id, username) => request('/rankings/submissions', { game_id, username }),
    rankings: (city, difficulty, offset = 0) => request(`/rankings?${new URLSearchParams({ city_id: city, difficulty, limit: 20, offset })}`),
  };
}
export function errorMessage(error) {
  return ({
    USERNAME_TAKEN: 'Ese nombre ya está ocupado. Elegí otro; tu resultado se conserva.',
    SESSION_REQUIRED: 'La sesión venció o se perdió. Sin la cookie de este navegador no podés recuperar esta partida ni su nombre. Podés iniciar una partida nueva.',
    GAME_NOT_ELIGIBLE: 'Esta partida ya no es elegible. Iniciá una nueva para clasificar.',
    BOARD_VERSION_CHANGED: 'El tablero cambió de versión. Iniciá una partida nueva para clasificar.',
  })[error.code] || error.message;
}
