import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { ApiError, fail, uuid } from './errors.mjs';

export const digest = value => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export class Store {
  constructor(path) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.migrate();
  }
  get(sql, ...args) { return this.db.prepare(sql).get(...args); }
  all(sql, ...args) { return this.db.prepare(sql).all(...args); }
  run(sql, ...args) { return this.db.prepare(sql).run(...args); }
  transaction(fn, write = true) {
    let begun = false;
    try {
      this.db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
      begun = true;
      const result = fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      if (begun) this.db.exec('ROLLBACK');
      if (error.errcode === 5 || error.errcode === 6) throw new ApiError('RETRY_LATER', null, 1);
      throw error;
    }
  }
  migrate() {
    this.transaction(() => {
      this.db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL) STRICT;');
      const sql = readFileSync(new URL('./migrations/001-rankings.sql', import.meta.url), 'utf8');
      const old = this.get('SELECT * FROM schema_migrations WHERE version=1');
      if (old && old.checksum !== digest(sql)) throw new Error('Migration checksum mismatch');
      if (!old) {
        this.db.exec(sql);
        this.run('INSERT INTO schema_migrations VALUES (1,?)', digest(sql));
      }
    });
  }
  mutate(playerId, key, path, body, now, fn) {
    if (!uuid(key)) fail('IDEMPOTENCY_KEY_REQUIRED');
    const hash = digest(`POST\n${path}\n${JSON.stringify(canonical(body))}`);
    return this.transaction(() => {
      const old = this.get('SELECT * FROM idempotency WHERE player_id=? AND key=?', playerId, key);
      if (old) {
        if (old.request_hash !== hash) fail('IDEMPOTENCY_CONFLICT');
        return { status: old.response_status, body: JSON.parse(old.response_json) };
      }
      const response = fn();
      this.run('INSERT INTO idempotency VALUES (?,?,?,?,?,?,?,?)', playerId, key, 'POST', path, hash, response.status, JSON.stringify(response.body), now);
      return response;
    });
  }
  close() { this.db.close(); }
}
