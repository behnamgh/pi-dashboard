import { duration, roomName, timestamp } from '../format.js';
const icons = { switch: '◉', contact: '▥', levels: '≋', watering: '♧' };
export function DeviceCard({ entry, timeZone }) {
  const { usage } = entry, latest = usage.latest;
  const status = entry.statuses.find(s => s.slug === latest?.statusSlug)?.label ?? 'Unknown';
  const value = entry.type === 'watering' ? (latest ? 'Watered' : 'Never recorded') : status;
  const summary = entry.type === 'switch' ? `${duration(usage.totalRuntimeSeconds)} in use` : entry.type === 'contact' ? `${usage.totalOpenings} openings` : entry.type === 'watering' ? `${usage.totalWaterings} waterings` : 'Reported levels';
  return <article className="device-card"><div className="device-top"><span className={'device-symbol type-' + entry.type} aria-hidden="true">{icons[entry.type]}</span><span className="eyebrow">{roomName(entry.roomId)}</span></div><h3>{entry.name}</h3><div className={'device-state ' + (latest ? 'known' : '')}>{value}</div><p className="device-time">{latest ? `${entry.type === 'watering' ? 'Last watered' : 'Reported'} ${timestamp(latest.occurredAt, timeZone)}` : 'Waiting for the first event'}</p><div className="device-summary">{summary}<span>Last 7 days</span></div></article>;
}
