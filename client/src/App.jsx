import { useEffect, useState } from 'react';
import { useDashboard } from './useDashboard.js';
import { Overview } from './pages/Overview.jsx';
import { Rooms } from './pages/Rooms.jsx';
import { ActivityLog } from './pages/ActivityLog.jsx';
import { DeviceSettings } from './pages/DeviceSettings.jsx';
import { timestamp } from './format.js';

function readLocation() { const [name, query = ''] = window.location.hash.slice(1).split('?'); return { page: ['overview','rooms','activity','settings'].includes(name) ? name : 'overview', activityRoom: new URLSearchParams(query).get('roomId') || '' }; }
export function App() {
  const [location, setLocation] = useState(readLocation), [roomId, setRoomId] = useState('bedroom');
  useEffect(() => { const change = () => setLocation(readLocation()); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  const { page, activityRoom } = location;
  const state = useDashboard(page === 'rooms' ? roomId : undefined);
  const navigate = (next, { roomId } = {}) => { window.location.hash = next + (next === 'activity' && roomId ? '?roomId=' + encodeURIComponent(roomId) : ''); setLocation({ page: next, activityRoom: roomId || '' }); };
  const titles = { overview: ['Your home, at a glance.', 'Latest reported states. A little more clarity about home.'], rooms: ['A closer look at home.', 'Your devices and plants, one room at a time.'], activity: ['The story of your home.', 'Every state change and watering, in one place.'], settings: ['Make yourself at home.', 'Add devices and plants, and connect your automations.'] };
  return <><header className="app-header"><div className="header-inner"><div className="brand"><span className="brand-icon" aria-hidden="true">⌂</span>Hearth</div><nav className="main-nav" aria-label="Main navigation">{[['overview','Overview'],['rooms','Rooms'],['activity','Activity log'],['settings','Device settings']].map(([key,label]) => <button key={key} aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)}>{label}</button>)}</nav><span className="local-label"><i className="local-dot"/>Local home dashboard</span></div></header><main><div className="page-intro"><div><h1>{titles[page][0]}</h1><p>{titles[page][1]}</p></div>{['overview','rooms'].includes(page) && <div className="refresh-state">{state.error ? 'Connection interrupted' : state.loading ? 'Connecting…' : 'Updated automatically'}<span>{state.lastSuccessAt ? `Last sync ${timestamp(state.lastSuccessAt, state.data?.timeZone)}` : 'Waiting for your server'}</span></div>}</div>{['overview','rooms'].includes(page) && <>{state.error && <div className="notice error" role="alert">Unable to refresh: {state.error}. {state.data ? 'Showing the last successful data.' : 'Check that the server is running.'} <button className="text-button" onClick={state.refresh}>Try again</button></div>}{page === 'rooms' ? <Rooms data={state.data} roomId={roomId} onRoomChange={setRoomId} navigate={navigate}/> : <Overview data={state.data} navigate={navigate}/ >}{state.loading && <div className="loading" role="status">Loading your home…</div>}</>}{page === 'activity' && <ActivityLog key={activityRoom} initialRoomId={activityRoom} timeZone={state.data?.timeZone} />}{page === 'settings' && <DeviceSettings onSaved={state.refresh}/>}<footer className="page-footer"><span>Hearth · Your home, your data.</span><span>{state.data?.timeZone || 'Local server'} · States reflect the last received event.</span></footer></main></>;
}
