import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

test('runtime SQLite nativo soporta transacciones, STRICT y rollback', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE probe (id INTEGER PRIMARY KEY) STRICT; BEGIN IMMEDIATE; INSERT INTO probe VALUES (1); ROLLBACK;');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM probe').get().n, 0);
    console.log('SQLite runtime:', db.prepare('SELECT sqlite_version() AS version').get().version);
  } finally { db.close(); }
});
