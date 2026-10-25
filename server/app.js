import express from 'express';
import { apiRoutes } from './routes.js';
import { resolve } from 'node:path';
export function createApp({ db, token, timeZone = 'Europe/Berlin', origin = 'http://localhost:3000', now = () => new Date(), staticDir, eventLogger = record => console.log(JSON.stringify(record)) } = {}) {
  const app = express(); app.disable('x-powered-by'); app.set('query parser', 'simple');
  app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'no-referrer'); next(); });
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', apiRoutes({ db, token, timeZone, origin, now, eventLogger }));
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'API endpoint not found.' } }));
  if (staticDir) app.use(express.static(resolve(staticDir), { dotfiles: 'deny', index: 'index.html' }));
  app.use((_req, res) => res.status(404).type('text').send('Not found.'));
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    res.status(status).json({ error: { code: error.code && typeof error.code === 'string' ? error.code : 'invalid_request', message: status < 500 ? (error.type === 'entity.parse.failed' ? 'Invalid JSON.' : error.message) : 'An unexpected server error occurred.' } });
  });
  return app;
}
