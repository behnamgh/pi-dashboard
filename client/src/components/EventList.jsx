import { roomName, timestamp } from '../format.js';
export function EventList({ events, timeZone }) {
  return events.length ? <div className="event-list">{events.map(event => <div className="event-row" key={event.id}><time dateTime={event.occurredAt}>{timestamp(event.occurredAt, timeZone)}</time><div><strong>{event.entryName}</strong><span>{roomName(event.roomId)}{event.archived ? ' · Archived' : ''}</span></div><span className="status-badge">{event.statusLabel}</span></div>)}</div> : <div className="empty-small">No events recorded yet.</div>;
}
