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

export function streetId(street) {
  return [...new Set(street.osm_way_ids)].sort((a, b) => a - b).join(',');
}

export function nextLevel(level, configuredLevels) {
  const index = configuredLevels.indexOf(level);
  return index < 0 ? null : configuredLevels[index + 1] ?? null;
}

export function getProgress(streets, level, state) {
  const ids = new Set(streets.filter(street => street.nivel === Number(level)).map(streetId));
  const solved = new Set(state.solvedByLevel[level] ?? []);
  const correct = [...ids].filter(id => solved.has(id)).length;
  return { correct, total: ids.size, completed: ids.size > 0 && correct === ids.size };
}

export function selectStreet(streets, level, previous = null, random = Math.random, solvedIds = []) {
  const levelStreets = streets.filter(street => street.nivel === Number(level));
  if (!levelStreets.length) throw new Error('No hay calles para este nivel.');
  const solved = new Set(solvedIds);
  const pool = levelStreets.filter(street => !solved.has(streetId(street)));
  if (!pool.length) return null;
  const alternatives = pool.filter(street => !previous || streetId(street) !== streetId(previous));
  const choices = alternatives.length ? alternatives : pool;
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))];
}

export function initialState(solvedByLevel = {}) {
  return { score: 0, streak: 0, hinted: false, resolved: false, solvedByLevel };
}

export function updateState(state, event, street = null) {
  if (event === 'next') return { ...state, hinted: false, resolved: false };
  if (state.resolved) return state;
  switch (event) {
    case 'hint': return { ...state, hinted: true };
    case 'wrong': return { ...state, streak: 0 };
    case 'skip': return { ...state, streak: 0, resolved: true };
    case 'correct': {
      let solvedByLevel = state.solvedByLevel;
      if (street) {
        const id = streetId(street);
        const solved = solvedByLevel[street.nivel] ?? [];
        if (solved.includes(id)) return { ...state, resolved: true };
        solvedByLevel = { ...solvedByLevel, [street.nivel]: [...solved, id] };
      }
      return { ...state, solvedByLevel, score: state.score + (state.hinted ? 5 : 10), streak: state.streak + 1, resolved: true };
    }
    default: return state;
  }
}

export function hintFor(street) {
  const words = normalizeName(street.nombre).split(' ');
  return `Empieza con «${words[0][0].toUpperCase()}» · ${words.length} ${words.length === 1 ? 'palabra' : 'palabras'} (sin prefijos).`;
}
