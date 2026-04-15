/** In dev, Vite proxies /api to the Nest server. In production, set VITE_API_BASE if API is on another host. */
const base = import.meta.env.VITE_API_BASE ?? '';

export async function fetchLinks({ page = 1, pageSize = 10 } = {}) {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const r = await fetch(`${base}/api/links?${qs.toString()}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function login(username, password) {
  const r = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) {
    let detail = r.statusText;
    try {
      const j = await r.json();
      if (j?.message) detail = Array.isArray(j.message) ? j.message.join(', ') : j.message;
    } catch {
      /* ignore */
    }
    throw new Error(detail || 'Login failed');
  }
  return r.json();
}

export function getToken() {
  return sessionStorage.getItem('portal_token');
}

export function setToken(t) {
  if (t) sessionStorage.setItem('portal_token', t);
  else sessionStorage.removeItem('portal_token');
}

export async function authFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const r = await fetch(`${base}${path}`, { ...options, headers });
  if (r.status === 401) {
    setToken(null);
    throw new Error('Session expired — sign in again');
  }
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  if (r.status === 204) return null;
  const ct = r.headers.get('content-type');
  if (ct && ct.includes('application/json')) return r.json();
  return r.text();
}
