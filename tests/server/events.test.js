import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../../server/db.js';
import { saveEntry, archiveEntry } from '../../server/entries.js';
const loaded = await import('../../server/events.js').catch(() => null);
const plant = { name: 'Plant', slug: 'plant', roomId: 'bedroom', type: 'watering' };
test('each watering and repeated state report is persisted as a distinct event', () => {
  assert.ok(loaded?.recordEvent, 'event collection is not implemented');
  const db = openDatabase(':memory:');
  try {
    saveEntry(db, plant); saveEntry(db, { ...plant, slug: 'tv', type: 'switch' });
    for (const slug of ['plant', 'plant', 'tv', 'tv']) loaded.recordEvent(db, { entrySlug: slug, statusSlug: slug === 'tv' ? 'on' : 'watered', occurredAt: '2026-10-25T10:00:00.000Z' });
    assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 4);
  } finally { db.close(); }
});
test('combined historical filters preserve room snapshots, stable pagination, and edited names', () => {
  assert.ok(loaded); const db = openDatabase(':memory:');
  try {
    const item = saveEntry(db, plant);
    for (const date of ['2026-10-24T22:00:00.000Z', '2026-10-25T10:00:00.000Z', '2026-10-25T10:00:00.000Z']) loaded.recordEvent(db, { entrySlug: 'plant', statusSlug: 'watered', occurredAt: date });
    saveEntry(db, { ...item, name: 'Renamed', roomId: 'bathroom' }, item.id); archiveEntry(db, item.id);
    const filters = { roomId: 'bedroom', entryId: String(item.id), status: 'watered', from: '2026-10-25', to: '2026-10-25', pageSize: '2', timeZone: 'Europe/Berlin' };
    const first = loaded.listEvents(db, filters), second = loaded.listEvents(db, { ...filters, page: '2' });
    assert.equal(first.total, 3); assert.equal(first.items[0].entryName, 'Renamed');
    assert.deepEqual([...first.items, ...second.items].map(e => e.id), [3, 2, 1]);
    assert.equal(loaded.listEvents(db, { roomId: 'bathroom' }).total, 0);
    for (const invalid of [{ pageSize: '101' }, { page: '0' }, { entryId: '1 OR 1=1' }, { from: '2026-02-30' }, { roomId: 'hallway' }, { from: '2026-10-25', to: '2026-10-20' }]) assert.throws(() => loaded.listEvents(db, invalid));
  } finally { db.close(); }
});
