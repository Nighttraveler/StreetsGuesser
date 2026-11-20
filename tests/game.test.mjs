import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeName, matchesAnswer, selectStreet, initialState, updateState, hintFor } from '../game.mjs';
const streets = JSON.parse(await readFile(new URL('../arrecifes_calles.json', import.meta.url)));

test('normaliza mayúsculas, tildes, espacios y todos los prefijos pedidos', () => {
  for (const prefix of ['Av.', 'Av', 'Avenida', 'Calle', 'Dr.', 'Dr', 'Gral.', 'Gral', 'Avenida Dr.']) {
    assert.equal(normalizeName(`  ${prefix}  RICARDO   GUTIÉRREZ  `), 'ricardo gutierrez');
  }
  assert.equal(normalizeName('Av.Merlassino'), 'merlassino');
  assert.equal(normalizeName('Avellaneda'), 'avellaneda');
  assert.equal(normalizeName('General Paz'), 'general paz');
  assert.equal(normalizeName('San Martín'), 'san martin');
  assert.equal(normalizeName('Callejón'), 'callejon');
});
test('alias Merlassino explícito, nombres originales y rechazos', () => {
  const street = streets.find(s => s.nombre === 'Avenida Carlos Merlassino');
  assert.ok(street);
  for (const answer of ['merlassino', 'av merlassino', 'Av. Merlassino', 'AVENIDA CARLOS MERLASSINO', 'Carlos Merlassino']) assert.ok(matchesAnswer(answer, street));
  assert.ok(matchesAnswer('merlassino', { nombre: 'Avenida Merlassino' }));
  for (const answer of ['', '  ', 'Carlos', 'Merlassin', 'x merlassino']) assert.equal(matchesAnswer(answer, street), false);
  assert.equal(matchesAnswer('belgrano', { nombre: 'Crucero General Belgrano' }), false);
  assert.ok(matchesAnswer('Dr. Ricardo Gutierrez', streets.find(s => s.nombre === 'Ricardo Gutiérrez')));
  assert.ok(matchesAnswer('variante', { nombre: 'Nombre', nombres_originales: ['Variante'] }));
});
test('selección exacta por nivel y extremos aleatorios con dataset real', () => {
  for (const [level, count] of [[1, 15], [2, 13], [3, 145]]) {
    const pool = streets.filter(s => s.nivel === level);
    assert.equal(pool.length, count);
    assert.equal(selectStreet(streets, level, null, () => 0), pool[0]);
    assert.equal(selectStreet(streets, String(level), null, () => 0.999999), pool.at(-1));
    for (let i = 0; i < count; i++) assert.equal(selectStreet(streets, level, null, () => i / count).nivel, level);
    assert.notEqual(selectStreet(streets, level, pool[0], () => 0), pool[0]);
  }
  assert.throws(() => selectStreet(streets, 4), /No hay calles/);
  assert.equal(selectStreet([streets[0]], streets[0].nivel, streets[0]), streets[0]);
});
test('puntos, racha, pista, error, salto y doble envío', () => {
  let state = initialState();
  state = updateState(state, 'correct');
  assert.deepEqual(state, { score: 10, streak: 1, hinted: false, resolved: true });
  assert.equal(updateState(state, 'correct'), state);
  assert.equal(updateState(state, 'skip'), state);
  state = updateState(state, 'next');
  state = updateState(state, 'hint');
  state = updateState(state, 'correct');
  assert.equal(state.score, 15);
  assert.equal(state.streak, 2);
  state = updateState(state, 'next');
  assert.equal(state.hinted, false);
  state = updateState(state, 'wrong');
  assert.equal(state.score, 15);
  assert.equal(state.streak, 0);
  assert.equal(state.resolved, false);
  state = updateState(state, 'correct');
  assert.equal(state.score, 25);
  state = updateState(updateState(state, 'next'), 'skip');
  assert.equal(state.score, 25);
  assert.equal(state.streak, 0);
  assert.equal(state.resolved, true);
  assert.deepEqual(initialState(), { score: 0, streak: 0, hinted: false, resolved: false });
});
test('pista usa letra y palabras sin prefijos', () => {
  assert.equal(hintFor({ nombre: 'Avenida Carlos Merlassino' }), 'Empieza con «C» · 2 palabras (sin prefijos).');
  assert.match(hintFor({ nombre: 'Avenida Belgrano' }), /«B» · 1 palabra /);
});
