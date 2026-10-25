import { FIXED_STATUSES, ROOMS, SLUG, TYPES } from '../shared/contracts.js';
import { requireValue } from './errors.js';

function label(value, field) {
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100, `${field} must be 1–100 characters.`);
  return value.trim();
}
export function validSlug(value) { return typeof value === 'string' && value.length <= 80 && SLUG.test(value); }
export function getEntry(db, id) {
  const row = db.prepare('SELECT * FROM entries WHERE id=?').get(id);
  if (!row) return null;
  return { id: row.id, name: row.name, slug: row.slug, roomId: row.room_id, type: row.type, archived: Boolean(row.archived), statuses: db.prepare('SELECT id,slug,label,position FROM statuses WHERE entry_id=? ORDER BY position,id').all(id) };
}
export function listEntries(db, { includeArchived = false, historyRoomId } = {}) {
  if (historyRoomId) requireValue(ROOMS.some(r => r.id === historyRoomId), 'Unknown room.');
  const rows = db.prepare(`SELECT id FROM entries WHERE (?=1 OR archived=0) AND (? IS NULL OR EXISTS(SELECT 1 FROM events WHERE events.entry_id=entries.id AND events.room_id=?)) ORDER BY name COLLATE NOCASE,id`).all(Number(includeArchived), historyRoomId ?? null, historyRoomId ?? null);
  return rows.map(r => getEntry(db, r.id));
}
export function saveEntry(db, input, id) {
  requireValue(input && typeof input === 'object' && !Array.isArray(input), 'Entry must be an object.');
  return db.transaction(() => {
    const old = id === undefined ? null : getEntry(db, id);
    if (id !== undefined) requireValue(old && !old.archived, 'Entry not found or archived.', 404, 'not_found');
    const value = { ...old, ...input };
    const name = label(value.name, 'Name');
    requireValue(validSlug(value.slug), 'URL slug must use lowercase letters, numbers and single hyphens (1–80 characters).');
    requireValue(ROOMS.some(r => r.id === value.roomId), 'Choose one of the four rooms.');
    requireValue(Object.hasOwn(TYPES, value.type), 'Unknown tracking type.');
    const duplicate = db.prepare('SELECT id FROM entries WHERE slug=?').get(value.slug);
    requireValue(!duplicate || duplicate.id === id, 'URL slug already exists.', 409, 'conflict');
    const hasHistory = old && db.prepare('SELECT 1 FROM events WHERE entry_id=? LIMIT 1').get(id);
    requireValue(!hasHistory || old.type === value.type, 'Tracking type cannot change after history exists.', 409, 'conflict');
    const statuses = FIXED_STATUSES[value.type] ?? value.statuses;
    requireValue(Array.isArray(statuses) && statuses.length >= (value.type === 'levels' ? 2 : 1) && statuses.length <= 20, 'Sensor levels require 2–20 statuses.');
    const normalized = statuses.map(s => {
      requireValue(s && validSlug(s.slug), 'Every status needs a valid URL slug.');
      return { slug: s.slug, label: label(s.label, 'Status label') };
    });
    requireValue(new Set(normalized.map(s => s.slug)).size === normalized.length, 'Status slugs must be unique.');
    if (old) for (const status of old.statuses) {
      const used = db.prepare('SELECT 1 FROM events WHERE status_id=? LIMIT 1').get(status.id);
      requireValue(!used || normalized.some(s => s.slug === status.slug), 'Historical status slugs cannot be changed or removed.', 409, 'conflict');
    }
    let entryId = id;
    if (old) db.prepare('UPDATE entries SET name=?,slug=?,room_id=?,type=? WHERE id=?').run(name, value.slug, value.roomId, value.type, id);
    else entryId = Number(db.prepare('INSERT INTO entries(name,slug,room_id,type) VALUES(?,?,?,?)').run(name, value.slug, value.roomId, value.type).lastInsertRowid);
    if (old) for (const status of old.statuses) if (!normalized.some(s => s.slug === status.slug)) db.prepare('DELETE FROM statuses WHERE id=?').run(status.id);
    const upsert = db.prepare('INSERT INTO statuses(entry_id,slug,label,position) VALUES(?,?,?,?) ON CONFLICT(entry_id,slug) DO UPDATE SET label=excluded.label,position=excluded.position');
    normalized.forEach((s, i) => upsert.run(entryId, s.slug, s.label, i));
    return getEntry(db, entryId);
  })();
}
export function archiveEntry(db, id) {
  requireValue(getEntry(db, id), 'Entry not found.', 404, 'not_found');
  db.prepare('UPDATE entries SET archived=1 WHERE id=?').run(id);
  return getEntry(db, id);
}
