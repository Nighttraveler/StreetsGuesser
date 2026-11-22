// Reglas puras, independientes del DOM y del transporte de datos.
export function isMapDrag(dx, dy) {
  return Math.hypot(dx, dy) >= 5;
}

export function panView(view, dx, dy, inverse) {
  return [view[0] - inverse.a * dx - inverse.c * dy,
    view[1] - inverse.b * dx - inverse.d * dy, view[2], view[3]];
}

export function normalizeName(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
    .replace(/^(?:(?:avenida|calle|av|dr|gral)(?:\.(?:\s*|$)|\s+|$))+/u, '')
    .replace(/\s+/g, ' ').trim();
}

export function matchesAnswer(answer, street) {
  const normalized = normalizeName(answer);
  if (!normalized) return false;
  const names = [street.nombre, ...(street.nombres_originales ?? [])];
  if (names.some(name => normalizeName(name) === normalized)) return true;
  return ['carlos merlassino', 'merlassino'].includes(normalizeName(street.nombre))
    && normalized === 'merlassino';
}

export function selectStreet(streets, level, previous = null, random = Math.random) {
  const pool = streets.filter(street => street.nivel === Number(level));
  if (!pool.length) throw new Error('No hay calles para este nivel.');
  const alternatives = pool.filter(street => street !== previous);
  const choices = alternatives.length ? alternatives : pool;
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))];
}

export function initialState() {
  return { score: 0, streak: 0, hinted: false, resolved: false };
}

export function updateState(state, event) {
  if (event === 'next') return { ...state, hinted: false, resolved: false };
  if (state.resolved) return state;
  switch (event) {
    case 'hint': return { ...state, hinted: true };
    case 'wrong': return { ...state, streak: 0 };
    case 'skip': return { ...state, streak: 0, resolved: true };
    case 'correct': return { ...state, score: state.score + (state.hinted ? 5 : 10), streak: state.streak + 1, resolved: true };
    default: return state;
  }
}

export function hintFor(street) {
  const words = normalizeName(street.nombre).split(' ');
  return `Empieza con «${words[0][0].toUpperCase()}» · ${words.length} ${words.length === 1 ? 'palabra' : 'palabras'} (sin prefijos).`;
}
