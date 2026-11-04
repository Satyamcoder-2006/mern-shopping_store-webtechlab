import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from './StoreContext';
import { api } from './api';
import { googleToken } from './neon';
import { Loading } from './ui';

export default function GoogleCallback() {
  const store = useStore(), navigate = useNavigate();
  const [error, setError] = useState('');
  const pending = useRef<Promise<any> | null>(null);
  useEffect(() => {
    let active = true;
    pending.current ??= googleToken().then(token => api('/api/auth/neon', 'POST', { token }));
    pending.current.then(data => {
      if (!active) return;
      store.setUser(data.user); store.setAuth(null); store.toast(data.message);
      let destination = { path: '/account', state: null as unknown };
      try {
        const saved = JSON.parse(sessionStorage.getItem('forme_google_return') || 'null');
        if (typeof saved?.path === 'string' && saved.path.startsWith('/') && !saved.path.startsWith('//') && !saved.path.includes('\\')) destination = saved;
      } catch {}
      sessionStorage.removeItem('forme_google_return');
      navigate(data.user.role === 'admin' ? '/admin' : destination.path, { replace: true, state: destination.state });
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  if (!error) return <Loading />;
  return <div className="empty"><h1>A small pause.</h1><p role="alert">{error}</p><Link className="btn dark" to="/account?tab=security">Back to your account</Link></div>;
}
