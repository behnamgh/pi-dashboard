import { ROOMS } from '../../shared/contracts.js';
export const roomName = id => ROOMS.find(r => r.id === id)?.name ?? id;
export function duration(seconds = 0) { const mins = Math.floor(seconds / 60); return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`; }
export function timestamp(value, timeZone) { return new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
export function weekday(date) { return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z')); }
