import { useEffect, useState } from 'react';
import { ROOMS } from '../../../shared/contracts.js';
import { api, queryString } from '../api.js';
import { EventList } from '../components/EventList.jsx';

export function ActivityLog({ initialRoomId = '', timeZone = 'Europe/Berlin', transport = api }) {
  const [filters, setFilters] = useState({ roomId: initialRoomId || '', entryId: '', status: '', from: '', to: '', page: 1 });
  const [entries, setEntries] = useState([]), [result, setResult] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    transport.get('/api/entries?' + queryString({ includeArchived: true, historyRoomId: filters.roomId }), { signal: controller.signal }).then(data => { if (active) setEntries(data.entries); }).catch(e => { if (active && e.name !== 'AbortError') setError(e.message); });
    return () => { active = false; controller.abort(); };
  }, [filters.roomId, transport]);
  const query = queryString(filters);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setLoading(true); setError(''); setResult(null);
    transport.get('/api/events?' + query, { signal: controller.signal }).then(data => { if (active) setResult(data); }).catch(e => { if (active && e.name !== 'AbortError') setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [query, transport, version]);
  const update = (field, value) => setFilters(f => ({ ...f, [field]: value, page: 1, ...(field === 'roomId' ? { entryId: '', status: '' } : {}), ...(field === 'entryId' ? { status: '' } : {}) }));
  const statuses = [...new Map(entries.filter(e => !filters.entryId || e.id === Number(filters.entryId)).flatMap(e => e.statuses).map(s => [s.slug, s])).values()];
  return <section className="panel"><div className="section-heading"><div><h2>Activity log</h2><p>Every event, across your devices and plants.</p></div><button className="button" onClick={() => setVersion(v => v + 1)} disabled={loading}>Refresh</button></div><div className="filter-grid"><div className="field"><label htmlFor="log-room">Room</label><select id="log-room" value={filters.roomId} onChange={e => update('roomId', e.target.value)}><option value="">All rooms</option>{ROOMS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div><div className="field"><label htmlFor="log-device">Device or plant</label><select id="log-device" value={filters.entryId} onChange={e => update('entryId', e.target.value)}><option value="">All entries</option>{entries.map(e => <option value={e.id} key={e.id}>{e.name}{e.archived ? ' · Archived' : ''}</option>)}</select></div><div className="field"><label htmlFor="log-status">Status</label><select id="log-status" value={filters.status} onChange={e => update('status', e.target.value)}><option value="">All statuses</option>{statuses.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}</select></div><div className="field"><label htmlFor="log-from">From</label><input id="log-from" type="date" value={filters.from} onChange={e => update('from', e.target.value)}/></div><div className="field"><label htmlFor="log-to">To</label><input id="log-to" type="date" value={filters.to} onChange={e => update('to', e.target.value)}/></div></div>{error && <div className="notice error" role="alert">{error}</div>}<div className="log-meta" aria-live="polite"><span>{loading ? 'Loading events…' : `${result?.total ?? 0} matching events`}</span><span>{timeZone} · Newest first</span></div>{result && (result.items.length ? <EventList events={result.items} timeZone={timeZone}/> : <div className="empty-small">No events match these filters.</div>)}{result && <div className="pagination"><button className="button" disabled={filters.page <= 1 || loading} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>Previous</button><span>Page {filters.page} of {Math.max(1, Math.ceil(result.total / result.pageSize))}</span><button className="button" disabled={filters.page * result.pageSize >= result.total || loading} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next</button></div>}</section>;
}
