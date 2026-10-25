import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const modules = await Promise.allSettled([import('../../server/db.js'), import('../../server/entries.js')]);
const storage = modules[0].value;
const entries = modules[1].value;
const plant = { name: 'Monstera', slug: 'bedroom-monstera', roomId: 'bedroom', type: 'watering' };

test('storage module provides a persistent database', () => assert.ok(storage?.openDatabase, 'persistent storage is not implemented'));
test('seeds exactly the fixed rooms and persists entries across reopen', () => {
  assert.ok(storage && entries, 'entry storage is not implemented');
  const dir = mkdtempSync(join(tmpdir(), 'hearth-')); let db;
  try {
    const path = join(dir, 'home.sqlite'); db = storage.openDatabase(path);
    assert.deepEqual(db.prepare('SELECT name FROM rooms ORDER BY id').all().map(r => r.name), ['Bathroom', 'Bedroom', 'Home office', 'Living room']);
    const saved = entries.saveEntry(db, plant); db.close(); db = storage.openDatabase(path);
    assert.equal(entries.getEntry(db, saved.id).name, 'Monstera');
    assert.equal(entries.getEntry(db, saved.id).statuses[0].slug, 'watered');
  } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('rejects invalid rooms, duplicate slugs, and invalid level definitions atomically', () => {
  assert.ok(storage && entries); const db = storage.openDatabase(':memory:');
  try {
    const item = entries.saveEntry(db, plant);
    assert.throws(() => entries.saveEntry(db, plant), /already exists/i);
    assert.throws(() => entries.saveEntry(db, { ...plant, roomId: 'hallway', slug: 'other' }), /room/i);
    for (const statuses of [[], [{ slug: 'normal', label: 'Normal' }], [{ slug: 'hot', label: 'Hot' }, { slug: 'hot', label: 'Hot' }], [{ slug: 'bad value', label: 'Bad' }, { slug: 'normal', label: 'Normal' }]]) {
      assert.throws(() => entries.saveEntry(db, { name: 'Sensor', slug: 'sensor', type: 'levels', roomId: 'bathroom', statuses }), /status|level|slug/i);
    }
    assert.throws(() => entries.saveEntry(db, { ...item, name: 'Changed', roomId: 'wrong' }, item.id), /room/i);
    assert.equal(entries.getEntry(db, item.id).name, 'Monstera');
  } finally { db.close(); }
});
test('historical statuses and types cannot be removed and archive preserves references', () => {
  assert.ok(storage && entries); const db = storage.openDatabase(':memory:');
  try {
    const item = entries.saveEntry(db, { name: 'Sensor', slug: 'sensor', roomId: 'bathroom', type: 'levels', statuses: [{ slug: 'normal', label: 'Normal' }, { slug: 'high', label: 'High' }] });
    db.prepare('INSERT INTO events(entry_id,status_id,room_id,occurred_at) VALUES(?,?,?,?)').run(item.id, item.statuses[0].id, 'bathroom', '2026-10-25T10:00:00.000Z');
    assert.throws(() => entries.saveEntry(db, { ...item, type: 'switch' }, item.id), /histor|type/i);
    assert.throws(() => entries.saveEntry(db, { ...item, statuses: [{ slug: 'low', label: 'Low' }, item.statuses[1]] }, item.id), /histor|status/i);
    const edited = entries.saveEntry(db, { ...item, roomId: 'bedroom', name: 'Renamed', statuses: [{ ...item.statuses[0], label: 'Comfortable' }, item.statuses[1], { slug: 'very-high', label: 'Very high' }] }, item.id);
    assert.equal(edited.statuses[0].id, item.statuses[0].id);
    entries.archiveEntry(db, item.id);
    assert.equal(entries.getEntry(db, item.id).archived, true);
    assert.equal(db.prepare('SELECT room_id FROM events').get().room_id, 'bathroom');
  } finally { db.close(); }
});
