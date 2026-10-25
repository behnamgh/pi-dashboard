import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { environment, emptyDashboard } from './helpers.js';
import { Overview } from '../pages/Overview.jsx';
import { Rooms } from '../pages/Rooms.jsx';
import { useDashboard } from '../useDashboard.js';
import { UsageChart } from '../components/UsageChart.jsx';
import { LevelTimeline } from '../components/LevelTimeline.jsx';

test('empty overview offers entry creation and room selection loads scoped data', async t => {
  const ui = environment(t); let destination;
  await ui.render(<Overview data={emptyDashboard} navigate={d => destination = d}/>);
  assert.match(ui.container.textContent, /add.*device|add.*entry/i);
  await ui.click([...ui.container.querySelectorAll('button')].find(b => /add/i.test(b.textContent)));
  assert.equal(destination, 'settings');
  let room;
  await ui.render(<Rooms data={emptyDashboard} roomId="bedroom" onRoomChange={id => room = id} navigate={() => {}}/>);
  await ui.click([...ui.container.querySelectorAll('button')].find(b => b.textContent === 'Bathroom'));
  assert.equal(room, 'bathroom');
});
test('unknown and never-watered cards do not fabricate live measurements', async t => {
  const ui = environment(t);
  const entries = ['levels','watering'].map((type, i) => ({ id: i+1, name: type === 'levels' ? 'Temperature' : 'Monstera', roomId: 'bedroom', type, statuses: [], usage: { latest: null, daily: [], totalWaterings: 0 } }));
  await ui.render(<Overview data={{ ...emptyDashboard, entries }} navigate={() => {}}/>);
  assert.match(ui.container.textContent, /Unknown/); assert.match(ui.container.textContent, /Never recorded/);
  assert.doesNotMatch(ui.container.textContent, /°C/);
});
test('polling refreshes at five seconds, retains stale data, and ignores obsolete room responses', async t => {
  const ui = environment(t); const requests = []; const timers = [];
  const transport = path => new Promise((resolve, reject) => requests.push({ path, resolve, reject }));
  const schedule = (fn, ms) => { timers.push({fn,ms}); return timers.length; };
  const cancel = () => {};
  let state;
  function Probe({ roomId }) { state = useDashboard(roomId, { get: transport, setTimer: schedule, clearTimer: cancel }); return <div>{state.data?.entries[0]?.name}{state.error && 'Offline'}</div>; }
  await ui.render(<Probe roomId="bedroom"/>);
  await act(async () => requests[0].resolve({ ...emptyDashboard, entries: [{ name: 'Bedroom device' }] }));
  assert.match(ui.container.textContent, /Bedroom device/); assert.equal(timers[0].ms, 5000);
  await act(async () => { timers[0].fn(); });
  await act(async () => requests[1].reject(new Error('Network unavailable')));
  assert.match(ui.container.textContent, /Bedroom deviceOffline/);
  await act(async () => { timers.at(-1).fn(); });
  await ui.render(<Probe roomId="bathroom"/>);
  await act(async () => requests.at(-1).resolve({ ...emptyDashboard, entries: [{ name: 'Bathroom device' }] }));
  await act(async () => requests[2].resolve({ ...emptyDashboard, entries: [{ name: 'Obsolete device' }] }));
  assert.match(ui.container.textContent, /Bathroom device/); assert.doesNotMatch(ui.container.textContent, /Obsolete/);
});
test('manual retry while offline keeps the last successful dashboard visible', async t => {
  const ui = environment(t); const requests = []; let state;
  const get = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
  const setTimer = () => 1, clearTimer = () => {};
  function Probe() { state = useDashboard(undefined, { get, setTimer, clearTimer }); return <div>{state.data?.entries[0]?.name}{state.error && ' Offline'}</div>; }
  await ui.render(<Probe/>);
  await act(async () => requests[0].resolve({ ...emptyDashboard, entries: [{ name: 'Cached TV state' }] }));
  await act(async () => state.refresh());
  assert.match(ui.container.textContent, /Cached TV state/);
  await act(async () => requests[1].reject(new Error('No connection')));
  assert.match(ui.container.textContent, /Cached TV state Offline/);
});
test('home and room views show dated daily door opening counts', async t => {
  const ui = environment(t);
  const door = { id: 8, name: 'Bathroom door', type: 'contact', roomId: 'bathroom', statuses: [{ slug: 'closed', label: 'Closed' }], usage: { latest: null, totalOpenings: 3, daily: [{ date: '2026-10-24', openings: 2 }, { date: '2026-10-25', openings: 1 }] } };
  const data = { ...emptyDashboard, entries: [door] };
  for (const view of [<Overview data={data} navigate={() => {}}/>, <Rooms data={data} roomId="bathroom" onRoomChange={() => {}} navigate={() => {}}/>]) {
    await ui.render(view);
    const table = ui.container.querySelector('table[aria-label="Daily door openings"]');
    assert.ok(table, 'daily door counts need an inspectable dated display');
    assert.match(table.textContent, /2026-10-24.*2/); assert.match(table.textContent, /2026-10-25.*1/);
  }
});
test('runtime and sensor charts provide numerical values outside image-only content', async t => {
  const ui = environment(t); const usage = { totalRuntimeSeconds: 7200, latest: null, daily: [{ date: '2026-10-25', runtimeSeconds: 7200, unknownSeconds: 3600, levelSeconds: { normal: 7200 } }] };
  await ui.render(<UsageChart entries={[{ id: 1, name: 'TV', type: 'switch', usage }]} days={['2026-10-25']}/>);
  const runtime = ui.container.querySelector('table[aria-label="Daily runtime values"]');
  assert.ok(runtime); assert.match(runtime.textContent, /2026-10-25.*2h 0m/);
  await ui.render(<LevelTimeline entry={{ id: 2, name: 'Temperature', type: 'levels', statuses: [{ id: 2, slug: 'normal', label: 'Normal' }], usage }} timeZone="Europe/Berlin"/>);
  const levels = ui.container.querySelector('table[aria-label="Temperature daily level durations"]');
  assert.ok(levels); assert.match(levels.textContent, /2026-10-25.*2h 0m.*1h 0m/);
});
test('runtime bars use the same hour scale as their axis label', async t => {
  const ui = environment(t);
  await ui.render(<UsageChart entries={[{ id: 1, name: 'TV', type: 'switch', usage: { totalRuntimeSeconds: 9000, daily: [{ date: '2026-10-25', runtimeSeconds: 9000 }] } }]} days={['2026-10-25']}/>);
  assert.match(ui.container.querySelector('.chart-axis').textContent, /3h/);
  assert.ok(Math.abs(parseFloat(ui.container.querySelector('.usage-bar').style.height) - 83.3333333) < 0.001);
});
test('a configured level named unknown does not overwrite unreported duration', async t => {
  const ui = environment(t);
  await ui.render(<LevelTimeline entry={{ name: 'Sensor', statuses: [{ slug: 'unknown', label: 'Sensor unavailable' }], usage: { latest: null, daily: [{ date: '2026-10-25', unknownSeconds: 3600, levelSeconds: { unknown: 7200 } }] } }} timeZone="Europe/Berlin"/>);
  assert.match(ui.container.querySelector('tbody').textContent, /2026-10-25.*2h 0m.*1h 0m/);
});
