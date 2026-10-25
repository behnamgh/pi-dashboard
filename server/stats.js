import { addDays, dateKey, dayStart } from './calendar.js';

export function aggregateUsage({ entries, events, now, timeZone }) {
  const end = new Date(now).getTime(), today = dateKey(end, timeZone);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const bounds = days.map(date => ({ date, start: dayStart(date, timeZone), end: Math.min(end, dayStart(addDays(date, 1), timeZone)) }));
  const first = bounds[0].start;
  const grouped = new Map();
  for (const event of events) {
    if (Date.parse(event.occurredAt) > end) continue;
    if (!grouped.has(event.entryId)) grouped.set(event.entryId, []);
    grouped.get(event.entryId).push(event);
  }
  return { days, entries: entries.map(entry => {
    const history = (grouped.get(entry.id) ?? []).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id - b.id);
    const daily = bounds.map(b => ({ date: b.date, runtimeSeconds: 0, openings: 0, waterings: 0, levelSeconds: Object.fromEntries(entry.statuses.map(s => [s.slug, 0])), unknownSeconds: entry.type === 'watering' ? 0 : (b.end - b.start) / 1000 }));
    let previous = null;
    history.forEach((event, i) => {
      const time = Date.parse(event.occurredAt), until = i + 1 < history.length ? Date.parse(history[i + 1].occurredAt) : end;
      const bucket = bounds.findIndex((b, j) => time >= b.start && (time < b.end || (j === bounds.length - 1 && time === end)));
      if (bucket !== -1) {
        if (entry.type === 'watering') daily[bucket].waterings++;
        if (entry.type === 'contact' && event.statusSlug === 'open' && previous !== 'open') daily[bucket].openings++;
      }
      if (entry.type !== 'watering' && until > first) bounds.forEach((b, j) => {
        const seconds = Math.max(0, Math.min(until, b.end) - Math.max(time, b.start)) / 1000;
        daily[j].unknownSeconds -= seconds;
        if (entry.type === 'switch' && event.statusSlug === 'on') daily[j].runtimeSeconds += seconds;
        if (entry.type === 'levels') daily[j].levelSeconds[event.statusSlug] = (daily[j].levelSeconds[event.statusSlug] ?? 0) + seconds;
      });
      previous = event.statusSlug;
    });
    const last = history.at(-1);
    return { entryId: entry.id, latest: last ? { statusSlug: last.statusSlug, occurredAt: last.occurredAt } : null, daily, unknownSeconds: daily.reduce((n, d) => n + d.unknownSeconds, 0), totalRuntimeSeconds: daily.reduce((n, d) => n + d.runtimeSeconds, 0), totalOpenings: daily.reduce((n, d) => n + d.openings, 0), totalWaterings: daily.reduce((n, d) => n + d.waterings, 0) };
  }) };
}
