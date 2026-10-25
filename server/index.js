import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readConfig } from './config.js';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

try {
  const config = readConfig();
  const built = existsSync(join(config.staticDir, 'index.html'));
  if (process.env.NODE_ENV === 'production' && !built) throw new Error('Frontend build is missing. Run npm run build before starting production.');
  const db = openDatabase(config.databasePath);
  const app = createApp({ ...config, db, staticDir: built ? config.staticDir : undefined });
  const server = app.listen(config.port, config.host, () => {
    console.log(`Hearth is listening on port ${config.port}. Dashboard origin: ${config.origin}`);
    if (!built) console.log('Frontend is not built. Use npm run dev or run npm run build.');
  });
  server.on('error', error => { console.error(`Unable to start Hearth (${error.code || 'server error'}). Check host, port and permissions.`); db.close(); process.exitCode = 1; });
  let stopping = false;
  function shutdown() {
    if (stopping) return; stopping = true;
    server.close(() => { db.close(); process.exitCode = 0; });
    server.closeIdleConnections();
  }
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
} catch (error) { console.error(error.message); process.exitCode = 1; }
