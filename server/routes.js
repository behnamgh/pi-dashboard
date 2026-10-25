import { Router } from 'express';
import { ROOMS } from '../shared/contracts.js';
import { archiveEntry, getEntry, listEntries, saveEntry, validSlug } from './entries.js';
import { listEvents, recordEvent, usageEvents } from './events.js';
import { aggregateUsage } from './stats.js';
import { addDays, dateKey, dayStart } from './calendar.js';
import { authorizeEvent, authorizeWrite } from './security.js';
import { requireValue } from './errors.js';

export function apiRoutes({ db, token, origin, timeZone, now, eventLogger }) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.all('/event/:device/:status', (req, res) => {
    const device = validSlug(req.params.device) ? req.params.device : '[invalid]';
    const status = validSlug(req.params.status) ? req.params.status : '[invalid]';
    const method = req.method, source = req.socket.remoteAddress || 'unknown';
    let eventId = null;
    res.once('finish', () => eventLogger({ kind: 'event_request', timestamp: now().toISOString(), method, device, status, httpStatus: res.statusCode, eventId, source }));
    requireValue(req.method === 'GET', 'Use GET for event ingestion.', 405, 'method_not_allowed');
    authorizeEvent(req, token);
    const event = recordEvent(db, { entrySlug: req.params.device, statusSlug: req.params.status, occurredAt: now().toISOString() });
    eventId = event.id;
    res.json({ event: { id: event.id, occurredAt: event.occurredAt } });
  });
  router.use((req, _res, next) => { if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) authorizeWrite(req, origin); next(); });
  router.get('/rooms', (_req, res) => res.json({ rooms: ROOMS }));
  router.get('/entries', (req, res) => {
    requireValue(req.query.includeArchived === undefined || ['true', 'false'].includes(req.query.includeArchived), 'Invalid archive filter.');
    res.json({ entries: listEntries(db, { includeArchived: req.query.includeArchived === 'true', historyRoomId: req.query.historyRoomId }) });
  });
  router.post('/entries', (req, res) => res.status(201).json({ entry: saveEntry(db, req.body) }));
  const id = value => { requireValue(/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)), 'Invalid entry ID.'); return Number(value); };
  router.patch('/entries/:id', (req, res) => res.json({ entry: saveEntry(db, req.body, id(req.params.id)) }));
  router.post('/entries/:id/archive', (req, res) => res.json({ entry: archiveEntry(db, id(req.params.id)) }));
  router.get('/events', (req, res) => res.json(listEvents(db, { ...req.query, timeZone })));
  router.get('/dashboard', (req, res) => {
    const roomId = req.query.roomId;
    requireValue(roomId === undefined || ROOMS.some(r => r.id === roomId), 'Unknown room.');
    const time = now(), generatedAt = time.toISOString();
    const entries = listEntries(db).filter(e => !roomId || e.roomId === roomId);
    const start = new Date(dayStart(addDays(dateKey(time, timeZone), -6), timeZone)).toISOString();
    const usage = aggregateUsage({ entries, events: usageEvents(db, start, generatedAt), now: time, timeZone });
    res.json({ generatedAt, timeZone, days: usage.days, entries: entries.map((e, i) => ({ ...e, usage: usage.entries[i] })), recentEvents: listEvents(db, { ...(roomId ? { roomId } : {}), pageSize: '6', timeZone }).items });
  });
  return router;
}
