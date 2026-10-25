import { DailyValues } from './DailyValues.jsx';
export function DoorActivity({ entries, days }) {
  const doors = entries.filter(e => e.type === 'contact');
  if (!doors.length) return null;
  const rows = days.map(date => ({ date, ...Object.fromEntries(doors.map(e => [e.id, e.usage.daily.find(d => d.date === date)?.openings ?? 0])) }));
  return <section className="panel door-panel"><div className="section-heading"><div><h2>Door openings</h2><p>Opening transitions per day · Last 7 days</p></div></div><DailyValues label="Daily door openings" columns={doors.map(e => ({ key: e.id, label: e.name }))} rows={rows} expandable={false}/></section>;
}
