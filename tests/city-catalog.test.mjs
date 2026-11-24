import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog } from '../ranked-game-client.mjs';

const city = { id: 'fixture-city', name: '<b>Ciudad</b> Ñ', difficulties: [{ id: 1, name: 'Fácil' }] };
test('catalog validation preserves exact names, order, all cities and empty results', () => {
  const result = { cities: [city, { ...city, id: 'other', name: 'Otra ciudad', difficulties: [] }] };
  assert.equal(validateCatalog(result), result);
  assert.deepEqual(validateCatalog({ cities: [] }), { cities: [] });
});
test('malformed catalogs are errors, never empty results', () => {
  for (const value of [null, {}, { cities: null }, { cities: {} }, { cities: [null] },
    { cities: [{ ...city, id: '' }] }, { cities: [{ ...city, name: ' ' }] },
    { cities: [{ ...city, difficulties: null }] }, { cities: [{ ...city, difficulties: [null] }] },
    { cities: [{ ...city, difficulties: [{ id: '1', name: 'Fácil' }] }] }]) {
    assert.throws(() => validateCatalog(value), /catálogo/i);
  }
});
