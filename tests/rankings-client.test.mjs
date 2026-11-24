import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRankedClient, errorMessage } from '../frontend/ranked-game-client.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
test('transport retry preserves exact key/body; corrected username gets a distinct key', async () => {
  const calls = [];
  let number = 0;
  const api = createRankedClient(async (path, options) => {
    calls.push({ path, ...options });
    if (calls.length === 1) throw new TypeError('connection lost');
    return json({ submission: { username: 'ana_7' } }, 201);
  }, () => `key-${++number}`);
  await assert.rejects(api.submit('game', ' Ana_7 '), { code: 'TRANSPORT', retryable: true });
  await api.submit('game', ' Ana_7 ');
  assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
  assert.equal(calls[0].body, calls[1].body);
  assert.deepEqual(JSON.parse(calls[0].body), { game_id: 'game', username: ' Ana_7 ' });
  assert.equal(calls[0].credentials, 'same-origin');
  await api.submit('game', 'bea_7');
  assert.notEqual(calls[1].headers['Idempotency-Key'], calls[2].headers['Idempotency-Key']);
});
test('business errors never become success and a corrected request is a new intention', async () => {
  let count = 0;
  const keys = [];
  const api = createRankedClient(async (path, options) => {
    keys.push(options.headers['Idempotency-Key']);
    return json({ error: { code: 'USERNAME_TAKEN', message: 'Ocupado', field: 'username', retryable: false } }, 409);
  }, () => `key-${++count}`);
  for (let i = 0; i < 2; i++) await assert.rejects(api.submit('game', 'ana'), { code: 'USERNAME_TAKEN' });
  assert.notEqual(keys[0], keys[1]);
  assert.match(errorMessage({ code: 'USERNAME_TAKEN' }), /ocupado/);
});
test('catalog/session/actions/board obey request contract without leaking client score', async () => {
  const calls = [];
  const api = createRankedClient(async (path, options) => {
    calls.push({ path, ...options });
    return json(path === '/api/v1/catalog' ? { cities: [] } : {});
  }, () => 'key');
  await api.catalog();
  await api.startSession();
  await api.action({ id: 'g', round: { id: 'r' }, score: 999 }, 'hint');
  await api.action({ id: 'g', round: { id: 'r' } }, 'answer', 'ruta 8');
  await api.rankings('arrecifes', 2, 20);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[1].headers['Idempotency-Key'], undefined);
  assert.deepEqual(JSON.parse(calls[2].body), { round_id: 'r', type: 'hint' });
  assert.deepEqual(JSON.parse(calls[3].body), { round_id: 'r', type: 'answer', answer: 'ruta 8' });
  assert.equal(calls[4].path, '/api/v1/rankings?city_id=arrecifes&difficulty=2&limit=20&offset=20');
});
test('unavailable or non-JSON APIs do not synthesize success', async () => {
  const api = createRankedClient(async () => new Response('offline', { status: 503 }));
  await assert.rejects(api.catalog(), { code: 'TRANSPORT', retryable: true });
});
