import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

const [source, target] = process.argv.slice(2);
if (!source || !target || !existsSync(source) || existsSync(target) || resolve(source) === resolve(target)) {
  throw new Error('Usage: node --experimental-sqlite ranked-game/backup.mjs EXISTING_DB NEW_BACKUP');
}
const db = new DatabaseSync(source, { readOnly: true });
try {
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  await backup(db, target);
  chmodSync(target, 0o600);
  const restored = new DatabaseSync(target, { readOnly: true });
  try {
    restored.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    if (restored.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || restored.prepare('PRAGMA foreign_key_check').all().length) {
      throw new Error('Backup verification failed');
    }
  } finally { restored.close(); }
  console.log('SQLite backup verified. Preserve the private dataset snapshots with it.');
} finally { db.close(); }
