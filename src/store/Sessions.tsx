import React, { useEffect, useState } from 'react';
import { api, setCsrf } from './api';
import { useStore } from './StoreContext';
export default function Sessions() {
  const store = useStore(), [sessions, setSessions] = useState<any[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = () => api('/api/users/me/sessions').then(setSessions).catch(e => setError(e.message));
  useEffect(() => { void load(); }, []);
  return <section className="panel session-panel"><h2>Your active sessions</h2><p>Up to three sessions can be active. Signing in a fourth time ends the oldest session. Each session expires after eight hours.</p>{error && <p role="alert" className="error-text">{error}</p>}{sessions.map(s => <div className="session-row" key={s.id}><div><strong>{s.current ? 'This session' : 'Another signed-in session'}</strong><small>Started {new Date(s.createdAt).toLocaleString('en-IN')}<br />Expires {new Date(s.expiresAt).toLocaleString('en-IN')}</small></div><button className="text-link" disabled={busy} onClick={async () => { setBusy(true); try { const result = await api(`/api/users/me/sessions/${s.id}`, 'DELETE'); if (result.current) { store.setUser(null); setCsrf(''); } else await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{s.current ? 'Sign out' : 'End session'}</button></div>)}</section>;
}
