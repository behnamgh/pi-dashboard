import test from 'node:test';
import assert from 'node:assert/strict';
const loaded = await import('../../server/config.js').catch(() => null);
test('configuration validates token, port, origin and timezone before startup', () => {
  assert.ok(loaded?.readConfig, 'startup configuration is not implemented');
  const base = { EVENT_TOKEN: 'a'.repeat(32) };
  const config = loaded.readConfig(base);
  assert.equal(config.port, 3000); assert.equal(config.timeZone, 'Europe/Berlin');
  for (const change of [{ EVENT_TOKEN: '' }, { EVENT_TOKEN: 'YOUR_EVENT_TOKEN' }, { PORT: '0' }, { PORT: 'abc' }, { PORT: '65536' }, { HOME_TIMEZONE: 'Wrong/Zone' }, { APP_ORIGIN: 'https://example.com/path' }, { APP_ORIGIN: 'javascript:alert(1)' }, { APP_ORIGIN: 'http://user:password@localhost:3000' }]) assert.throws(() => loaded.readConfig({ ...base, ...change }));
});
