import React, { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { api } from './api';
import { beginGoogleSignIn, googleConfigured } from './neon';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from './StoreContext';
import { Modal, Field, ErrorNote } from './ui';
export default function Auth() {
  const { auth, setAuth, setUser, toast } = useStore();
  const navigate = useNavigate(), location = useLocation();
  const [values, setValues] = useState({ username: '', emailId: '', age: '', password: '' }), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  if (!auth) return null;
  const signup = auth === 'signup';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { const data = await api(signup ? '/api/users' : '/api/login', 'POST', { ...values, age: Number(values.age) }); setUser(data.user); setAuth(null); setValues({ username: '', emailId: '', age: '', password: '' }); toast(data.message); if (data.user.role === 'admin') navigate('/admin', { replace: true }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const input = (key: keyof typeof values) => ({ value: values[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [key]: e.target.value }) });
  return <Modal title={signup ? 'A little more you.' : 'Good to see you again.'} close={() => setAuth(null)}><p className="muted">{signup ? 'Create your FORME account. Save your favourites and make good clothes part of your everyday.' : 'Log in for your saved pieces, orders, and a little less checkout admin.'}</p>{googleConfigured && <><button className="btn outline full google-signin" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await beginGoogleSignIn(location.pathname + location.search, location.state); } catch (e) { setError((e as Error).message); setBusy(false); } }}>Continue with Google</button><p className="auth-divider">or use your email</p></>}<form onSubmit={submit} className="form-stack"><ErrorNote message={error} />{signup && <Field label="Your name"><input {...input('username')} autoComplete="name" required minLength={2} maxLength={80} placeholder="First and last name" /></Field>}<Field label="Email address"><input {...input('emailId')} type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></Field>{signup && <Field label="Age"><input {...input('age')} type="number" min="1" max="120" required placeholder="Your age" /></Field>}<Field label="Password"><input {...input('password')} type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : 1} maxLength={128} required placeholder={signup ? 'At least 8 characters' : 'Your password'} /></Field><button className="btn dark full" disabled={busy}>{busy ? 'One moment…' : signup ? 'Create account' : 'Log in'}<ArrowRight size={17} /></button></form><div className="auth-switch">{signup ? 'Already part of the edit?' : 'New around here?'} <button className="text-link" onClick={() => { setError(''); setAuth(signup ? 'login' : 'signup'); }}>{signup ? 'Log in' : 'Create an account'}</button></div><p className="security-copy"><LockKeyhole size={13} /> Your account. Your corner. Kept private.</p></Modal>;
}
