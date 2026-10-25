import { requireValue } from './errors.js';
import { ROOMS } from '../shared/contracts.js';
import { validSlug } from './entries.js';
import { addDays, dayStart, validDate } from './calendar.js';

const SELECT = `SELECT e.id,e.entry_id AS entryId,e.status_id AS statusId,s.slug AS statusSlug,s.label AS statusLabel,e.room_id AS roomId,e.occurred_at AS occurredAt,n.name AS entryName,n.slug AS entrySlug,n.type AS entryType,n.archived FROM events e JOIN entries n ON n.id=e.entry_id JOIN statuses s ON s.id=e.status_id`;
export function recordEvent(db, { entrySlug, statusSlug, occurredAt }) {
  requireValue(validSlug(entrySlug) && validSlug(statusSlug), 'Invalid entry or status slug.');
  return db.transaction(() => {
    const entry = db.prepare('SELECT id,room_id FROM entries WHERE slug=? AND archived=0').get(entrySlug);
    requireValue(entry, 'Entry not found or archived.', 404, 'not_found');
    const status = db.prepare('SELECT id FROM statuses WHERE entry_id=? AND slug=?').get(entry.id, statusSlug);
    requireValue(status, 'Status is not defined for this entry.');
    requireValue(typeof occurredAt === 'string' && Number.isFinite(Date.parse(occurredAt)), 'Invalid event time.');
    const timestamp = new Date(occurredAt).toISOString();
    const id = Number(db.prepare('INSERT INTO events(entry_id,status_id,room_id,occurred_at) VALUES(?,?,?,?)').run(entry.id, status.id, entry.room_id, timestamp).lastInsertRowid);
    return db.prepare(SELECT + ' WHERE e.id=?').get(id);
  })();
}
function positive(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  requireValue(typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= max, 'Invalid pagination or entry ID.');
  return Number(value);
}
export function listEvents(db, filters = {}) {
  const { roomId, entryId, status, from, to, timeZone = 'Europe/Berlin' } = filters;
  const clauses = [], args = [];
  const add = (sql, value) => { clauses.push(sql); args.push(value); };
  if (roomId !== undefined) { requireValue(ROOMS.some(r => r.id === roomId), 'Unknown room.'); add('e.room_id=?', roomId); }
  if (entryId !== undefined) add('e.entry_id=?', positive(entryId));
  if (status !== undefined) { requireValue(validSlug(status), 'Invalid status filter.'); add('s.slug=?', status); }
  if (from !== undefined) { requireValue(validDate(from), 'Invalid start date.'); add('e.occurred_at>=?', new Date(dayStart(from, timeZone)).toISOString()); }
  if (to !== undefined) { requireValue(validDate(to), 'Invalid end date.'); add('e.occurred_at<?', new Date(dayStart(addDays(to, 1), timeZone)).toISOString()); }
  requireValue(!(from && to && from > to), 'Start date must not follow end date.');
  const page = positive(filters.page, 1), pageSize = positive(filters.pageSize, 50, 100);
  requireValue(Number.isSafeInteger((page - 1) * pageSize), 'Page is too large.');
  const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
  const total = db.prepare('SELECT count(*) AS n FROM (' + SELECT + where + ')').get(...args).n;
  const items = db.prepare(SELECT + where + ' ORDER BY e.occurred_at DESC,e.id DESC LIMIT ? OFFSET ?').all(...args, pageSize, (page - 1) * pageSize);
  return { items, total, page, pageSize };
}
export function usageEvents(db, start, end) {
  return db.prepare(SELECT + ` WHERE n.archived=0 AND e.occurred_at<=? AND (e.occurred_at>=? OR e.id=(SELECT p.id FROM events p WHERE p.entry_id=e.entry_id AND p.occurred_at<? ORDER BY p.occurred_at DESC,p.id DESC LIMIT 1)) ORDER BY e.occurred_at,e.id`).all(end, start, start);
}
