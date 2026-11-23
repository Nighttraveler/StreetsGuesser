import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { streetId } from '../game.mjs';
import { digest } from './database.mjs';
import { fail } from './errors.mjs';

const names = { 1: 'Fácil', 2: 'Medio', 3: 'Difícil' };
export class Catalog {
  constructor(store, snapshotDir, registrations) {
    this.store = store;
    this.snapshots = new Map();
    mkdirSync(snapshotDir, { recursive: true, mode: 0o700 });
    for (const registration of registrations) this.register(snapshotDir, registration);
    for (const row of store.all('SELECT * FROM datasets')) {
      const bytes = readFileSync(row.immutable_path);
      if (digest(bytes) !== row.content_hash || row.version !== row.content_hash) throw new Error('Dataset checksum mismatch');
      const streets = this.validate(bytes);
      this.snapshots.set(`${row.city_id}/${row.version}`, streets);
    }
  }
  validate(bytes) {
    const streets = JSON.parse(bytes);
    if (!Array.isArray(streets) || !streets.length) throw new Error('Empty dataset');
    const ids = new Set();
    for (const street of streets) {
      if (!Array.isArray(street.osm_way_ids) || !street.osm_way_ids.length || !street.osm_way_ids.every(Number.isSafeInteger)
        || typeof street.nombre !== 'string' || !street.nombre.trim() || ![1, 2, 3].includes(street.nivel)) throw new Error('Invalid street');
      const id = streetId(street);
      if (ids.has(id)) throw new Error('Duplicate street ID');
      ids.add(id);
    }
    return streets;
  }
  register(dir, { id, name, path, rulesVersion = '1' }) {
    if (typeof id !== 'string' || id.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Invalid city ID');
    if (rulesVersion !== '1') throw new Error('Unsupported rules version');
    const bytes = readFileSync(path);
    const streets = this.validate(bytes);
    const version = digest(bytes);
    const target = resolve(join(dir, `${version}.json`));
    if (!existsSync(target)) writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
    if (digest(readFileSync(target)) !== version) throw new Error('Snapshot checksum mismatch');
    this.store.transaction(db => {
      db.run('INSERT INTO cities VALUES (?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name', id, name);
      db.run('INSERT OR IGNORE INTO datasets VALUES (?,?,?,?)', id, version, version, target);
      for (const level of new Set(streets.map(street => street.nivel))) {
        db.run(`INSERT INTO boards VALUES (?,?,?,?) ON CONFLICT(city_id,difficulty) DO UPDATE SET
          active_dataset_version=excluded.active_dataset_version, active_rules_version=excluded.active_rules_version`, id, level, version, rulesVersion);
      }
    });
  }
  city(id) {
    const city = this.store.get('SELECT * FROM cities WHERE id=?', id);
    if (!city) fail('CITY_NOT_FOUND', 'city_id');
    return city;
  }
  board(cityId, difficulty) {
    this.city(cityId);
    const board = this.store.get('SELECT * FROM boards WHERE city_id=? AND difficulty=?', cityId, difficulty);
    if (!board) fail('BOARD_NOT_FOUND', 'difficulty');
    return board;
  }
  dataset(cityId, version) {
    this.city(cityId);
    const data = this.snapshots.get(`${cityId}/${version}`);
    if (!data) fail('DATASET_NOT_FOUND');
    return data;
  }
  view() {
    return { cities: this.store.all('SELECT * FROM cities ORDER BY id').map(city => ({
      id: city.id, name: city.display_name,
      difficulties: this.store.all('SELECT difficulty FROM boards WHERE city_id=? ORDER BY difficulty', city.id)
        .map(row => ({ id: row.difficulty, name: names[row.difficulty] })),
    })) };
  }
}
