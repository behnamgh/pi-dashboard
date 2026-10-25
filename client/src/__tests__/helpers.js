import { JSDOM } from 'jsdom';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
export function environment(t) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true });
  const names = ['window', 'document', 'navigator', 'HTMLElement', 'Event', 'MouseEvent', 'IS_REACT_ACT_ENVIRONMENT'];
  const descriptors = names.map(n => [n, Object.getOwnPropertyDescriptor(globalThis, n)]);
  for (const name of names.slice(0, -1)) Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true, writable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.getElementById('root'), root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [n, d] of descriptors) { if (d) Object.defineProperty(globalThis, n, d); else delete globalThis[n]; } });
  return { container, render: async node => act(async () => root.render(node)), click: async element => act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))), change: async (element, value) => act(async () => { const prototype = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value); element.dispatchEvent(new dom.window.Event('input', { bubbles: true })); element.dispatchEvent(new dom.window.Event('change', { bubbles: true })); }) };
}
export const emptyDashboard = { generatedAt: '2026-10-25T12:00:00Z', timeZone: 'Europe/Berlin', days: ['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25'], entries: [], recentEvents: [] };
