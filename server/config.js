import { resolve } from 'node:path';
export function readConfig(env = process.env) {
  const token = env.EVENT_TOKEN;
  if (typeof token !== 'string' || token.length < 24 || token.length > 1024 || /YOUR_EVENT_TOKEN|replace-me|change-me/i.test(token)) throw new Error('Set EVENT_TOKEN to a random secret of at least 24 characters in .env.');
  const port = Number(env.PORT || 3000);
  if (!/^\d+$/.test(String(env.PORT || 3000)) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  const timeZone = env.HOME_TIMEZONE || 'Europe/Berlin';
  try { new Intl.DateTimeFormat('en', { timeZone }).format(); } catch { throw new Error('HOME_TIMEZONE must be a valid IANA timezone.'); }
  let origin;
  try {
    const url = new URL(env.APP_ORIGIN || `http://localhost:${port}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    origin = url.origin;
  } catch { throw new Error('APP_ORIGIN must be the dashboard origin, e.g. http://raspberrypi.local:3000 (no path).'); }
  return { token, port, host: env.HOST || '0.0.0.0', timeZone, origin, databasePath: resolve(env.DATABASE_PATH || './data/hearth.sqlite'), staticDir: resolve('dist') };
}
