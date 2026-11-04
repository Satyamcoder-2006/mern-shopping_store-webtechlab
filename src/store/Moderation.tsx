import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from './StoreContext';
import { api } from './api';
import { Loading } from './ui';
export default function Moderation() {
  const store = useStore(), [data, setData] = useState<any>(null), [error, setError] = useState(''), [busy, setBusy] = useState('');
  const load = async () => { try { setData(await api('/api/admin/community')); } catch (e) { setError((e as Error).message); } };
  useEffect(() => { if (store.user?.role === 'admin') void load(); }, [store.user?.id]);
  if (store.sessionLoading) return <Loading />;
  if (store.user?.role !== 'admin') return <div className="empty"><h1>Admin access required.</h1><Link className="btn dark" to="/account">Your account</Link></div>;
  const remove = async (id: string, url: string) => { setBusy(id); try { await api(url, 'DELETE'); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); } };
  return <div className="community-page"><Link className="underlined" to="/admin">Back to admin studio</Link><div className="page-heading"><span className="eyebrow">ADMIN · COMMUNITY</span><h1>Keep it <em>considered.</em></h1><p>Review the latest 50 posts and reviews. Remove inappropriate content and its attached images.</p></div>{error && <p role="alert" className="error-text">{error}</p>}{!data ? <Loading /> : <div className="moderation-grid"><section><h2>Outfit face-offs</h2>{!data.posts.length && <p>No posts yet.</p>}{data.posts.map((p: any) => <article className="review-card" key={p._id}><strong>{p.author} · {p.title}</strong><p>{p.caption}</p><div className="review-photos">{p.looks.map((l: any) => <img key={l.image} src={l.image} alt={l.label} />)}</div><button className="text-link danger" disabled={!!busy} onClick={() => remove(p._id, `/api/faceoffs/${p._id}`)}>Remove post</button></article>)}</section><section><h2>Product reviews</h2>{!data.reviews.length && <p>No reviews yet.</p>}{data.reviews.map((r: any) => <article className="review-card" key={r._id}><strong>{r.author} · {r.rating}/5</strong><Link to={`/product/${r.productId}`}>{r.productId}</Link><p>{r.text}</p><div className="review-photos">{r.images.map((i: string) => <img key={i} src={i} alt="Review attachment" />)}</div><button className="text-link danger" disabled={!!busy} onClick={() => remove(r._id, `/api/admin/reviews/${r._id}`)}>Remove review</button></article>)}</section></div>}</div>;
}
