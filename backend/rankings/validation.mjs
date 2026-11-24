import { fail } from '../ranked-game/errors.mjs';
const reserved = new Set(['admin', 'administrator', 'moderator', 'support', 'system', 'anonymous']);
export function normalizeUsername(value) {
  if (typeof value !== 'string' || [...value].length > 64) fail('INVALID_USERNAME', 'username');
  const name = value.replace(/^ +| +$/g, '').replace(/[A-Z]/g, letter => letter.toLowerCase());
  if (!/^[a-z0-9_]{3,20}$/.test(name)) fail('INVALID_USERNAME', 'username');
  if (reserved.has(name)) fail('USERNAME_RESERVED', 'username');
  return name;
}
export function rankingQuery(params) {
  const allowed = ['city_id', 'difficulty', 'limit', 'offset'];
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) fail('INVALID_QUERY', key);
  const city = params.get('city_id');
  if (!city || city.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(city)) fail('INVALID_QUERY', 'city_id');
  const integer = (key, fallback, min, max) => {
    const value = params.get(key) ?? fallback;
    if (value === undefined || !/^(0|[1-9][0-9]*)$/.test(value) || Number(value) < min || Number(value) > max) fail('INVALID_QUERY', key);
    return Number(value);
  };
  return { city, difficulty: integer('difficulty', undefined, 1, 3), limit: integer('limit', '20', 1, 100), offset: integer('offset', '0', 0, 10000) };
}
