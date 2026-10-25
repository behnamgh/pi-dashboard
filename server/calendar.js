import { requireValue } from './errors.js';
const formatters = new Map();
export function dateKey(value, timeZone) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }));
  const parts = Object.fromEntries(formatters.get(timeZone).formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value && value >= '1970-01-01' && value <= '9998-12-31';
}
export function addDays(date, amount) { return new Date(Date.parse(date + 'T12:00:00Z') + amount * 86400000).toISOString().slice(0, 10); }
// Find the first instant of the local date. Calendar comparisons avoid assuming a 24h day.
export function dayStart(date, timeZone) {
  requireValue(validDate(date), 'Invalid calendar date.');
  const center = Date.parse(date + 'T00:00:00Z');
  let low = center - 36 * 3600000, high = center + 36 * 3600000;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (dateKey(mid, timeZone) < date) low = mid + 1; else high = mid;
  }
  return low;
}
