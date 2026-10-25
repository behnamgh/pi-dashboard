import { createHash, timingSafeEqual } from 'node:crypto';
import { requireValue } from './errors.js';
export function authorizeEvent(req, token) {
  const supplied = req.query.token;
  requireValue(typeof supplied === 'string' && supplied.length <= 1024 && timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(token).digest()), 'Invalid event token.', 401, 'unauthorized');
}
export function authorizeWrite(req, origin) {
  requireValue(req.get('origin') === origin, 'Settings writes require the configured app origin.', 403, 'forbidden');
  requireValue(req.is('application/json'), 'Settings writes require application/json.', 415, 'unsupported_media_type');
}
