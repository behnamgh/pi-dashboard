import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ROOMS } from '../shared/contracts.js';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path);
  try {
    db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON'); db.pragma('busy_timeout = 5000');
    const version = db.pragma('user_version', { simple: true });
    if (version > 1) throw new Error('Database was created by a newer version of Hearth.');
    db.transaction(() => {
      if (version === 0) db.exec(readFileSync(new URL('./migrations/001-initial.sql', import.meta.url), 'utf8'));
      const seed = db.prepare('INSERT OR IGNORE INTO rooms(id,name) VALUES(?,?)');
      for (const room of ROOMS) seed.run(room.id, room.name);
    })();
    return db;
  } catch (error) { db.close(); throw error; }
}
