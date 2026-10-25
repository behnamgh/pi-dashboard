import test from 'node:test';
import assert from 'node:assert/strict';
const loaded = await import('../../server/stats.js').catch(() => null);
const entry = (type = 'switch') => ({ id: 1, type, statuses: type === 'levels' ? [{ slug: 'normal' }, { slug: 'hot' }] : [] });
const event = (time, status, id = 1) => ({ id, entryId: 1, occurredAt: time, statusSlug: status });
function run(type, events, now = '2026-10-25T23:00:00.000Z') {
  assert.ok(loaded?.aggregateUsage, 'usage aggregation is not implemented');
  return loaded.aggregateUsage({ entries: [entry(type)], events, now: new Date(now), timeZone: 'Europe/Berlin' }).entries[0];
}
test('runtime handles duplicate reports, open sessions, unknown history and midnight splitting', () => {
  const result = run('switch', [event('2026-10-24T21:00:00Z', 'on', 1), event('2026-10-24T21:15:00Z', 'on', 2), event('2026-10-24T23:00:00Z', 'off', 3)]);
  assert.equal(result.totalRuntimeSeconds, 7200);
  assert.equal(result.daily.find(d => d.date === '2026-10-24').runtimeSeconds, 3600);
  assert.equal(result.daily.find(d => d.date === '2026-10-25').runtimeSeconds, 3600);
  assert.equal(run('switch', [event('2026-10-25T22:00:00Z', 'on')]).totalRuntimeSeconds, 3600);
  assert.equal(run('switch', [event('2026-10-25T22:00:00Z', 'off')]).totalRuntimeSeconds, 0);
  assert.equal(run('switch', []).latest, null);
});
test('calendar aggregation respects 25-hour and 23-hour days', () => {
  const fall = run('switch', [event('2026-10-24T22:00:00Z', 'on')], '2026-10-25T23:00:00.000Z');
  assert.equal(fall.daily.find(d => d.date === '2026-10-25').runtimeSeconds, 90000);
  const spring = run('switch', [event('2026-03-28T23:00:00Z', 'on')], '2026-03-29T22:00:00.000Z');
  assert.equal(spring.daily.find(d => d.date === '2026-03-29').runtimeSeconds, 82800);
});
test('carries pre-window states, counts every watering but only transitions into open', () => {
  const carry = run('switch', [event('2026-10-01T00:00:00Z', 'on')], '2026-10-25T12:00:00Z');
  assert.equal(carry.daily.length, 7); assert.equal(carry.daily[0].runtimeSeconds, 86400); assert.equal(carry.daily[6].runtimeSeconds, 50400);
  assert.equal(run('watering', [event('2026-10-25T10:00:00Z', 'watered', 1), event('2026-10-25T10:00:00Z', 'watered', 2)]).totalWaterings, 2);
  assert.equal(run('contact', [event('2026-10-25T10:00:00Z', 'open', 1), event('2026-10-25T10:01:00Z', 'open', 2), event('2026-10-25T10:02:00Z', 'closed', 3), event('2026-10-25T10:03:00Z', 'open', 4)]).totalOpenings, 2);
});
test('level allocation preserves unknown duration and timestamp tie ordering', () => {
  const result = run('levels', [event('2026-10-25T10:00:00Z', 'normal', 1), event('2026-10-25T10:00:00Z', 'hot', 2)], '2026-10-25T11:00:00Z');
  const day = result.daily.at(-1);
  assert.equal(day.levelSeconds.normal, 0); assert.equal(day.levelSeconds.hot, 3600);
  assert.equal(day.unknownSeconds, 43200); assert.equal(result.latest.statusSlug, 'hot');
});
