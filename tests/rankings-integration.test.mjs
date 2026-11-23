import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const backend = process.env.RANKINGS_BACKEND_ROOT
  ? pathToFileURL(`${resolve(process.env.RANKINGS_BACKEND_ROOT)}/ranked-game/http.mjs`)
  : new URL('ranked-game/http.mjs', root);

test('real SQLite API + Chromium: two owners, full games, canonical conflict and ordered board', { skip: !existsSync(backend) && 'Backend not combined yet; set RANKINGS_BACKEND_ROOT' }, async () => {
  const { createApplication } = await import(backend.href);
  const data = JSON.parse(await readFile(new URL('arrecifes_calles.json', root)));
  const temporary = await mkdtemp(join(process.env.TMPDIR || tmpdir(), 'rankings-ui-integration-'));
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const app = createApplication({ development: true, host: '127.0.0.1', origin,
    dbPath: join(temporary, 'test.sqlite'), snapshotDir: join(temporary, 'snapshots'), staticRoot: root,
    registrations: [{ id: 'arrecifes', name: 'Arrecifes', path: new URL('arrecifes_calles.json', root) }],
  });
  let browser;
  try {
    await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const pages = [];
    for (const hinted of [true, false]) {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin);
      await page.locator('#answer:enabled').waitFor();
      await page.locator('#catalog-load').click();
      await page.locator('#rank-start:enabled').click();
      await page.locator('#ranked-status').filter({ hasText: 'Modo clasificado' }).waitFor();
      assert.equal(await page.locator('#progress').innerText(), '0/15');
      for (let i = 0; i < 15; i++) {
        await page.locator('#answer:enabled').waitFor();
        if (i === 0 && hinted) {
          await page.locator('#hint').click();
          await page.locator('#hint-text').filter({ hasText: 'Empieza' }).waitFor();
          await page.locator('#answer:enabled').waitFor();
        }
        const index = Number(await page.locator('g:has(path.active)').getAttribute('data-street-index'));
        await page.locator('#answer').fill(data[index].nombre);
        await page.locator('#submit').click();
        await page.locator('#progress').filter({ hasText: new RegExp(`^${i + 1}/15$`) }).waitFor();
        if (i < 14) await page.locator('#next:enabled').click();
      }
      await page.locator('#publication:visible').waitFor();
      assert.equal(await page.locator('#score').innerText(), hinted ? '145' : '150');
      const cookie = (await context.cookies()).find(cookie => cookie.name === 'arrecifes_session');
      assert.ok(cookie?.httpOnly);
      assert.deepEqual(errors, []);
      pages.push(page);
    }
    await pages[0].locator('#username').fill(' Ana_7 ');
    await pages[0].locator('#publish-consent').check();
    await pages[0].locator('#publish').click();
    await pages[0].locator('#publication-status').filter({ hasText: 'Resultado publicado como ana_7' }).waitFor();
    await pages[1].locator('#username').fill('ANA_7');
    await pages[1].locator('#publish-consent').check();
    await pages[1].locator('#publish').click();
    await pages[1].locator('#publication-status').filter({ hasText: 'ocupado' }).waitFor();
    await pages[1].locator('#username').fill('bea_9');
    await pages[1].locator('#publish').click();
    await pages[1].locator('#publication-status').filter({ hasText: 'Resultado publicado como bea_9' }).waitFor();
    await pages[1].locator('#ranking-list li').filter({ hasText: 'ana_7' }).waitFor();
    const rows = await pages[1].locator('#ranking-list li').allTextContents();
    assert.equal(rows.length, 2);
    assert.match(rows[0], /bea_9 · 150/);
    assert.match(rows[1], /ana_7 · 145/);
    await pages[1].locator('#rank-difficulty').selectOption('2');
    await pages[1].locator('#ranking-status').filter({ hasText: 'Todavía no hay' }).waitFor();
    assert.equal(await pages[1].locator('#ranking-list li').count(), 0);
  } finally {
    await browser?.close();
    await app.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
