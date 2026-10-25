import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
const setTimerDefault = (fn, ms) => setTimeout(fn, ms);
const clearTimerDefault = id => clearTimeout(id);
export function useDashboard(roomId, { get = api.get, setTimer = setTimerDefault, clearTimer = clearTimerDefault } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true, lastSuccessAt: null });
  const [version, setVersion] = useState(0); const current = useRef(0);
  const previousRoom = useRef(roomId);
  useEffect(() => {
    let active = true, timer, controller; const generation = ++current.current;
    const scopeChanged = previousRoom.current !== roomId;
    previousRoom.current = roomId;
    setState(s => scopeChanged ? { data: null, error: null, loading: true, lastSuccessAt: null } : { ...s, loading: !s.data });
    async function load() {
      clearTimer(timer); controller?.abort(); controller = new AbortController();
      try {
        const data = await get('/api/dashboard' + (roomId ? '?roomId=' + encodeURIComponent(roomId) : ''), { signal: controller.signal });
        if (active && generation === current.current) setState({ data, error: null, loading: false, lastSuccessAt: new Date() });
      } catch (error) {
        if (active && generation === current.current && error.name !== 'AbortError') setState(s => ({ ...s, error: error.message, loading: false }));
      } finally { if (active && generation === current.current && !document.hidden) timer = setTimer(load, 5000); }
    }
    const visible = () => { if (document.hidden) { clearTimer(timer); controller?.abort(); } else load(); };
    load(); document.addEventListener('visibilitychange', visible);
    return () => { active = false; clearTimer(timer); controller?.abort(); document.removeEventListener('visibilitychange', visible); };
  }, [roomId, version, get, setTimer, clearTimer]);
  return { ...state, refresh: () => setVersion(v => v + 1) };
}
