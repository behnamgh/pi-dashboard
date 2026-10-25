async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Request failed.');
  return data;
}
export const api = {
  get: (path, options) => request(path, options),
  write: (path, { method = 'POST', body = {} } = {}) => request(path, { method, body: JSON.stringify(body) }),
};
export function queryString(filters) { const query = new URLSearchParams(); for (const [k, v] of Object.entries(filters)) if (v !== '' && v !== undefined && v !== null) query.set(k, v); return query.toString(); }
