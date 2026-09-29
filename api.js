import { CONFIG } from './config.js';

const SESSION_KEY = 'bg-christmas-2026-host';
let session = null;
try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { /* Storage can be disabled. */ }
let refreshing = null;
let authGeneration = 0;

export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}

async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(CONFIG.supabaseUrl + path, {
      method,
      headers: { apikey: CONFIG.publishableKey, 'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { throw new ApiError('The server returned an unexpected response.', response.status); }
    if (!response.ok) {
      throw new ApiError(data?.message || data?.msg || data?.error_description || data?.error || 'The request could not be completed.', response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Connection unavailable or timed out. Please check your internet connection and try again.');
  } finally { clearTimeout(timeout); }
}

export const rpc = (name, args = {}) => request(`/rest/v1/rpc/${name}`, { method: 'POST', body: args });

function saveSession(data) {
  session = data ? { ...data, expires_at: data.expires_at || Math.floor(Date.now() / 1000) + data.expires_in } : null;
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* The session still works in memory. */ }
}

export const hasSession = () => Boolean(session?.access_token);
export async function signIn(email, password) {
  const generation = ++authGeneration;
  const data = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (!data?.access_token) throw new ApiError('Sign-in did not return a session.');
  if (generation !== authGeneration) throw new ApiError('Sign-in was cancelled.');
  saveSession(data);
}

async function accessToken() {
  if (!session?.access_token) throw new ApiError('Please sign in to continue.', 401);
  if (session.expires_at > Date.now() / 1000 + 60) return session.access_token;
  if (!refreshing) {
    const generation = authGeneration;
    refreshing = request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: session.refresh_token }
    }).then(data => {
      if (generation !== authGeneration) throw new ApiError('Please sign in to continue.', 401);
      if (!data?.access_token) throw new ApiError('Please sign in again.', 401);
      saveSession(data); return data.access_token;
    }).catch(error => {
      if (generation === authGeneration && (error.status === 400 || error.status === 401)) saveSession(null);
      throw error;
    }).finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function signOut() {
  authGeneration++;
  const token = session?.access_token;
  saveSession(null);
  if (token) await request('/auth/v1/logout?scope=local', { method: 'POST', token });
}

export async function currentUser() { return request('/auth/v1/user', { token: await accessToken() }); }

const fields = 'id,created_at,household_name,attendance,adults,children,food_category,bringing,quantity,dietary_requirements';
export async function listRsvps() {
  const rows = [];
  const token = await accessToken();
  for (let offset = 0; ; offset += 1000) {
    const batch = await request(`/rest/v1/rsvps?select=${fields}&order=created_at.desc,id.asc&limit=1000&offset=${offset}`, { token });
    if (!Array.isArray(batch)) throw new ApiError('Could not read the RSVP list.');
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

export async function updateHostRsvp(id, values) {
  const rows = await request(`/rest/v1/rsvps?id=eq.${encodeURIComponent(id)}&select=${fields}`, {
    method: 'PATCH', token: await accessToken(), body: values,
    headers: { Prefer: 'return=representation' }
  });
  if (!Array.isArray(rows) || rows.length !== 1) throw new ApiError('This RSVP is unavailable, or your account does not have host permission.');
  return rows[0];
}

export async function deleteHostRsvp(id) {
  const rows = await request(`/rest/v1/rsvps?id=eq.${encodeURIComponent(id)}&select=id`, {
    method: 'DELETE', token: await accessToken(), headers: { Prefer: 'return=representation' }
  });
  if (!Array.isArray(rows) || rows.length !== 1) throw new ApiError('This RSVP could not be removed. Check your host permissions and refresh.');
}
