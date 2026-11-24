import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeName, matchesAnswer, selectStreet, initialState, updateState, hintFor, isMapDrag, panView, streetId, getProgress, nextLevel } from '../game.mjs';
const streets = JSON.parse(await readFile(new URL('../arrecifes_calles.json', import.meta.url)));

test('umbral euclidiano de arrastre en píxeles CSS, inclusive y simétrico', () => {
  assert.equal(isMapDrag(0, 0), false);
  assert.equal(isMapDrag(3, 3), false);
  assert.equal(isMapDrag(3, 4), true);
  assert.equal(isMapDrag(-5, 0), true);
  assert.equal(isMapDrag(0, -6), true);
});
test('desplazamiento SVG usa la parte lineal de la matriz y preserva zoom sin mutar', () => {
  const view = [10, 20, 300, 100];
  assert.deepEqual(panView(view, 12, -8, { a: 2, b: 0, c: 0, d: 2, e: 999, f: 999 }), [-14, 36, 300, 100]);
  assert.deepEqual(panView(view, -12, 8, { a: .5, b: 1, c: -1, d: .5 }), [24, 28, 300, 100]);
  assert.deepEqual(view, [10, 20, 300, 100]);
});
test('pan táctil incremental conserva escala y vuelve al origen al invertir cada eje', () => {
  const original = [10, 20, 300, 100];
  const inverse = { a: .5, b: 0, c: 0, d: .5 };
  let camera = original;
  for (const [dx, dy, expected] of [
    [30, 0, [-5, 20, 300, 100]],
    [0, -40, [-5, 40, 300, 100]],
    [-30, 0, [10, 40, 300, 100]],
    [0, 40, original],
  ]) {
    camera = panView(camera, dx, dy, inverse);
    assert.deepEqual(camera, expected);
  }
  assert.deepEqual(original, [10, 20, 300, 100]);
});
test('siguiente dificultad respeta configuración, sin envolver ni inventar niveles', () => {
  assert.equal(nextLevel('1', ['1', '2', '3']), '2');
  assert.equal(nextLevel('2', ['1', '2', '3']), '3');
  assert.equal(nextLevel('3', ['1', '2', '3']), null);
  assert.equal(nextLevel('1', ['1', '3']), '3');
  assert.equal(nextLevel('4', ['1', '2', '3']), null);
  assert.equal(nextLevel('1', []), null);
});

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
test('alias cortos generales para todas las rutas reales sin mutar sus registros', () => {
  const routes = streets.filter(s => /ruta/i.test(s.nombre));
  assert.equal(routes.length, 3);
  for (const street of routes) {
    const before = structuredClone(street);
    const number = street.nombre.match(/\d+$/)[0];
    for (const answer of [street.nombre, ...street.nombres_originales, `ruta ${number}`, `ex ruta ${number}`, `Ex-Ruta ${number}`, `  RÚTA   ${number}  `]) {
      assert.equal(matchesAnswer(answer, street), true, `${answer} → ${street.nombre}`);
    }
    for (const answer of ['', number, `ruta ${number}0`, `ex ruta ${number}0`, `ruta ${number} extra`, `otra ruta ${number}`, `ruta ${number.slice(0, -1)}`]) {
      assert.equal(matchesAnswer(answer, street), false, `${answer} ≠ ${street.nombre}`);
    }
    for (const other of routes.filter(s => s !== street)) {
      assert.equal(matchesAnswer(`ruta ${other.nombre.match(/\d+$/)[0]}`, street), false);
    }
    assert.deepEqual(street, before);
  }
});
test('rutas de otros números y nombres originales sin alias parciales o calificadores inventados', () => {
  for (const number of ['7', '80', '510', '1234']) {
    for (const prefix of ['Ruta', 'Ruta Nacional', 'Ex-Ruta Provincial', 'Ex Ruta Nacional']) {
      const street = { nombre: `${prefix} ${number}` };
      assert.equal(matchesAnswer(`ruta ${number}`, street), true);
      assert.equal(matchesAnswer(`ex ruta ${number}`, street), true);
      assert.equal(matchesAnswer(`ruta ${number.slice(0, -1)}`, street), false);
    }
  }
  assert.equal(matchesAnswer('ruta 22', { nombre: 'Acceso', nombres_originales: ['Ex-Ruta Nacional 22'] }), true);
  for (const nombre of ['Camino a Ruta Nacional 8', 'Ruta Nacional 8 bis', 'Ruta Municipal 8', 'Calle 8', 'Ruta Nacional 80']) {
    assert.equal(matchesAnswer('ruta 8', { nombre }), false);
  }
  assert.equal(matchesAnswer('ruta provincial 8', { nombre: 'Ex-Ruta Nacional 8' }), false);
  assert.equal(matchesAnswer('ruta nacional 51', { nombre: 'Ruta Provincial 51' }), false);
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
  assert.deepEqual(state, { score: 10, streak: 1, hinted: false, resolved: true, solvedByLevel: {} });
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
  assert.deepEqual(initialState(), { score: 0, streak: 0, hinted: false, resolved: false, solvedByLevel: {} });
});
test('pista usa letra y palabras sin prefijos', () => {
  assert.equal(hintFor({ nombre: 'Avenida Carlos Merlassino' }), 'Empieza con «C» · 2 palabras (sin prefijos).');
  assert.match(hintFor({ nombre: 'Avenida Belgrano' }), /«B» · 1 palabra /);
});

test('identidad OSM estable, independiente de nombre, orden e instancia', () => {
  const street = streets[0];
  const clone = { ...street, nombre: 'Otro nombre', osm_way_ids: [...street.osm_way_ids].reverse() };
  assert.equal(streetId(street), streetId(clone));
  assert.equal(streetId({ osm_way_ids: [2, 10, 2] }), '2,10');
  assert.notEqual(streetId(streets[1]), streetId(street));
  const alternative = streets.find(s => s.nivel === street.nivel && s !== street);
  assert.equal(selectStreet([street, alternative], street.nivel, clone, () => 0), alternative);
});

test('progreso único de 0 a total y agotamiento para cada dificultad real', () => {
  for (const [level, total] of [[1, 15], [2, 13], [3, 145]]) {
    let state = initialState();
    const seen = new Set();
    assert.deepEqual(getProgress(streets, String(level), state), { correct: 0, total, completed: false });
    for (let i = 0; i < total; i++) {
      const current = selectStreet(streets, level, null, () => .5, state.solvedByLevel[level]);
      assert.ok(current);
      assert.equal(seen.has(streetId(current)), false);
      seen.add(streetId(current));
      const before = state;
      state = updateState(state, 'correct', current);
      assert.equal(getProgress(streets, level, before).correct, i);
      assert.deepEqual(getProgress(streets, level, state), { correct: i + 1, total, completed: i + 1 === total });
      assert.equal(updateState(state, 'correct', current), state);
      const next = updateState(state, 'next');
      const duplicate = updateState(next, 'correct', { ...current });
      assert.equal(duplicate.score, state.score);
      assert.equal(getProgress(streets, level, duplicate).correct, i + 1);
      state = next;
    }
    assert.equal(selectStreet(streets, level, null, () => 0, state.solvedByLevel[level]), null);
    assert.equal(state.score, total * 10);
  }
});

test('errores, pistas y saltos no retiran calles; última pendiente sigue elegible', () => {
  const street = streets.find(s => s.nivel === 1);
  let state = initialState();
  for (const event of ['wrong', 'hint', 'skip']) {
    state = updateState(state, event, street);
    assert.deepEqual(getProgress([street], 1, state), { correct: 0, total: 1, completed: false });
    assert.equal(selectStreet([street], 1, { ...street }, () => 0, state.solvedByLevel[1]), street);
  }
  state = updateState(state, 'next');
  state = updateState(state, 'hint', street);
  state = updateState(state, 'correct', street);
  assert.equal(state.score, 5);
  assert.deepEqual(getProgress([street], 1, state), { correct: 1, total: 1, completed: true });
});

test('progreso separado por dificultad, reinicio de marcadores y partida nueva', () => {
  const easy = streets.find(s => s.nivel === 1);
  const medium = streets.find(s => s.nivel === 2);
  let state = updateState(initialState(), 'correct', easy);
  state = initialState(state.solvedByLevel);
  assert.equal(state.score, 0);
  assert.equal(state.streak, 0);
  assert.equal(getProgress(streets, 1, state).correct, 1);
  assert.equal(getProgress(streets, 2, state).correct, 0);
  state = updateState(state, 'correct', medium);
  assert.equal(getProgress(streets, 1, state).correct, 1);
  assert.equal(getProgress(streets, 2, state).correct, 1);
  assert.equal(getProgress(streets, 1, initialState()).correct, 0);
  assert.deepEqual(getProgress(streets, 4, state), { correct: 0, total: 0, completed: false });
  assert.deepEqual(getProgress([easy, { ...easy }], 1, state), { correct: 1, total: 1, completed: true });
});
