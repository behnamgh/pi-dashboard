import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../../server/db.js';
import { saveEntry, archiveEntry } from '../../server/entries.js';
import { inject } from './inject.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const loaded = await import('../../server/app.js').catch(() => null);
function setup(t) {
  assert.ok(loaded?.createApp, 'HTTP API is not implemented');
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const entry = saveEntry(db, { name: 'Plant', slug: 'plant', roomId: 'bedroom', type: 'watering' });
  return { db, entry, app: loaded.createApp({ db, token: 'test-token', timeZone: 'Europe/Berlin', origin: 'http://localhost:3000', now: () => new Date('2026-10-25T10:00:00Z') }) };
}
test('ingestion authenticates, validates, records concurrent waterings and never caches', async t => {
  const { app, db, entry } = setup(t);
  for (const query of ['', '?token=wrong', '?token=test-token&token=test-token']) assert.equal((await inject(app, { url: '/api/event/plant/watered' + query })).status, 401);
  assert.equal((await inject(app, { url: '/api/event/plant/on?token=test-token' })).status, 400);
  assert.equal((await inject(app, { url: '/api/event/absent/watered?token=test-token' })).status, 404);
  assert.equal((await inject(app, { method: 'HEAD', url: '/api/event/plant/watered?token=test-token' })).status, 405);
  const results = await Promise.all([inject(app, { url: '/api/event/plant/watered?token=test-token' }), inject(app, { url: '/api/event/plant/watered?token=test-token' })]);
  for (const res of results) { assert.equal(res.status, 200); assert.equal(res.headers['cache-control'], 'no-store'); assert.ok(res.body.event.id); assert.equal(res.body.event.occurredAt, '2026-10-25T10:00:00.000Z'); }
  assert.equal(db.prepare('SELECT count(*) n FROM events').get().n, 2);
  archiveEntry(db, entry.id);
  assert.equal((await inject(app, { url: '/api/event/plant/watered?token=test-token' })).status, 404);
});
test('settings accepts only same-origin JSON and provides bounded errors', async t => {
  const { app } = setup(t); const body = { name: 'TV', slug: 'tv', roomId: 'living-room', type: 'switch' };
  for (const origin of [undefined, 'https://evil.example']) assert.equal((await inject(app, { method: 'POST', url: '/api/entries', body, headers: origin ? { origin } : {} })).status, 403);
  assert.equal((await inject(app, { method: 'POST', url: '/api/entries', body, headers: { origin: 'http://localhost:3000', 'content-type': 'text/plain' } })).status, 415);
  const good = await inject(app, { method: 'POST', url: '/api/entries', body, headers: { origin: 'http://localhost:3000' } });
  assert.equal(good.status, 201); assert.equal(good.body.entry.roomId, 'living-room');
  assert.equal((await inject(app, { method: 'POST', url: '/api/entries', body, headers: { origin: 'http://localhost:3000' } })).status, 409);
  assert.equal((await inject(app, { url: '/api/events?pageSize=101' })).status, 400);
  const missing = await inject(app, { url: '/api/missing?token=secret' }); assert.equal(missing.status, 404); assert.ok(missing.body.error); assert.ok(!JSON.stringify(missing.body).includes('secret'));
});
test('production serves built assets without exposing data and dashboard reflects recorded events', async t => {
  const { db } = setup(t); const dir = mkdtempSync(join(tmpdir(), 'hearth-static-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Hearth</title>');
  writeFileSync(join(dir, 'app.js'), 'console.log("hearth")');
  const app = loaded.createApp({ db, token: 'test-token', timeZone: 'Europe/Berlin', origin: 'http://localhost:3000', now: () => new Date('2026-10-25T10:00:00Z'), staticDir: dir });
  assert.equal((await inject(app)).status, 200);
  assert.match((await inject(app, { url: '/app.js' })).body, /hearth/);
  assert.equal((await inject(app, { url: '/.env' })).status, 404);
  assert.equal((await inject(app, { url: '/data/hearth.sqlite' })).status, 404);
  assert.equal((await inject(app, { url: '/api/nope' })).status, 404);
  await inject(app, { url: '/api/event/plant/watered?token=test-token' });
  const dashboard = await inject(app, { url: '/api/dashboard?roomId=bedroom' });
  assert.equal(dashboard.body.entries[0].usage.totalWaterings, 1);
  assert.equal(dashboard.body.days.length, 7);
  assert.equal((await inject(app, { url: '/api/dashboard?roomId=bathroom' })).body.entries.length, 0);
});
