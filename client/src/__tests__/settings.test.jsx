import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { environment } from './helpers.js';
import { DeviceSettings } from '../pages/DeviceSettings.jsx';
test('creates a plant in exactly one room and shows the watering endpoint', async t => {
  const ui = environment(t); let saved;
  const transport = { get: async () => ({ entries: [] }), write: async (_path, { body }) => { saved = body; return { entry: { ...body, id: 1, statuses: [{ id: 1, slug: 'watered', label: 'Watered' }] } }; } };
  await ui.render(<DeviceSettings transport={transport}/>);
  await ui.change(ui.container.querySelector('#entry-name'), 'Monstera');
  await ui.change(ui.container.querySelector('#entry-slug'), 'bedroom-monstera');
  await ui.change(ui.container.querySelector('#entry-room'), 'bedroom');
  await ui.change(ui.container.querySelector('#entry-type'), 'watering');
  await act(async () => ui.container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(saved.name, 'Monstera'); assert.equal(saved.roomId, 'bedroom'); assert.equal(saved.type, 'watering');
  assert.match(ui.container.textContent, /bedroom-monstera\/watered/); assert.doesNotMatch(ui.container.textContent, /remind/i);
});
test('conflicting saves retain form values and surface errors instead of losing edits', async t => {
  const ui = environment(t);
  const transport = { get: async () => ({ entries: [] }), write: async () => { throw new Error('URL slug already exists.'); } };
  await ui.render(<DeviceSettings transport={transport}/>);
  await ui.change(ui.container.querySelector('#entry-name'), 'Desk lamp');
  await ui.change(ui.container.querySelector('#entry-slug'), 'desk-lamp');
  await ui.change(ui.container.querySelector('#entry-room'), 'home-office');
  await act(async () => ui.container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.match(ui.container.querySelector('[role=alert]').textContent, /already exists/);
  assert.equal(ui.container.querySelector('#entry-name').value, 'Desk lamp');
});
