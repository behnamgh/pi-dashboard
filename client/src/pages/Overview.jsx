import { DeviceCard } from '../components/DeviceCard.jsx';
import { UsageChart } from '../components/UsageChart.jsx';
import { LevelTimeline } from '../components/LevelTimeline.jsx';
import { EventList } from '../components/EventList.jsx';
import { DoorActivity } from '../components/DoorActivity.jsx';
export function Overview({ data, navigate, roomId }) {
  if (!data) return null;
  const sensors = data.entries.filter(e => e.type === 'levels');
  return <>{!data.entries.length ? <section className="panel empty-state"><span className="empty-symbol" aria-hidden="true">⌂</span><h2>A place for everything at home.</h2><p>Add your first device or plant, then send an event from Apple Home or a Shortcut.</p><button className="button primary" onClick={() => navigate('settings')}>Add a device or plant</button></section> : <><div className="section-heading"><h2>{roomId ? 'In this room' : 'Your devices & plants'}</h2><span className="subtle">{data.entries.length} tracked</span></div><div className="device-grid">{data.entries.map(entry => <DeviceCard key={entry.id} entry={entry} timeZone={data.timeZone}/>)}</div><div className="dashboard-panels"><UsageChart entries={data.entries} days={data.days}/><section className="panel"><div className="section-heading"><div><h2>Home climate</h2><p>Reported levels · Last 7 days</p></div></div>{sensors.length ? sensors.map(entry => <LevelTimeline key={entry.id} entry={entry} timeZone={data.timeZone}/>) : <div className="empty-small">No climate sensors in this view.</div>}</section></div><DoorActivity entries={data.entries} days={data.days}/></>}<section className="panel"><div className="section-heading"><div><h2>Recent activity</h2><p>{roomId ? 'Events recorded in this room' : 'Across your home'}</p></div><button className="text-button" onClick={() => navigate('activity', { roomId })}>View all activity →</button></div><EventList events={data.recentEvents} timeZone={data.timeZone}/></section></>;
}
