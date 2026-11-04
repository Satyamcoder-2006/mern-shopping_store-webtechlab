import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, LockKeyhole, PackageCheck, Truck, Tag, X } from 'lucide-react';
import { useStore } from './StoreContext';
import { api } from './api';
import { money, date, type Order, type BagItem } from './types';
import { Empty, Loading, Field, Picture, ErrorNote } from './ui';
export function Checkout() {
  const store = useStore(), location = useLocation(), navigate = useNavigate();
  const direct = location.state?.buyNow as BagItem | undefined;
  const items = direct ? [direct] : store.bag;
  const itemKey = JSON.stringify(items);
  const [address, setAddress] = useState({ fullName: store.user?.username || '', phone: '', line1: '', city: '', state: '', pinCode: '' });
  const [coupon, setCoupon] = useState(''), [applied, setApplied] = useState(''), [quote, setQuote] = useState<any>(null), [quoteBusy, setQuoteBusy] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => { requestId.current = crypto.randomUUID(); }, [itemKey, applied, JSON.stringify(address)]);
  useEffect(() => { if (store.user && !address.fullName) setAddress(prev => ({ ...prev, fullName: store.user!.username })); }, [store.user]);
  useEffect(() => {
    let current = true; setQuote(null);
    if (!store.user || !items.length) return;
    setQuoteBusy(true); setError('');
    api('/api/checkout/quote', 'POST', { items, couponCode: applied }).then(data => { if (current) setQuote(data); }).catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setQuoteBusy(false); });
    return () => { current = false; };
  }, [itemKey, applied, store.user?.id]);
  const place = async (e: React.FormEvent) => {
    e.preventDefault(); if (!quote) return; setBusy(true); setError('');
    try { const order: Order = await api('/api/orders', 'POST', { items, couponCode: applied, address, paymentMethod: 'cod', requestId: requestId.current });
      if (!direct) store.setBag([]); await store.refreshProducts(); navigate(`/order/${order.orderId}`, { replace: true });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  if (store.sessionLoading) return <Loading />;
  if (!store.user) return <div className="section checkout-auth"><span className="eyebrow">ONE SMALL STEP</span><h1>Your next favourite<br /><em>is almost yours.</em></h1><p>Log in or create an account to keep your order details in one place.</p><button className="btn dark" onClick={() => store.setAuth('login')}>Log in to checkout <ArrowRight size={17} /></button><button className="text-link" onClick={() => store.setAuth('signup')}>Create an account</button></div>;
  if (!items.length) return <Empty title="Your bag is taking a breather." text="Find a piece you love before checking out." />;
  const input = (key: keyof typeof address) => ({ value: address[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAddress({ ...address, [key]: e.target.value }) });
  return <div className="checkout-page"><div className="page-heading"><span className="eyebrow">THE LAST LITTLE STEP</span><h1>Make it <em>yours.</em></h1><p>Your everyday is about to get a good new addition.</p></div><form className="checkout-grid" onSubmit={place}><div className="checkout-main"><section className="panel"><div className="number-heading"><span>01</span><h2>Where are we heading?</h2></div><div className="form-grid"><Field label="Full name"><input {...input('fullName')} required minLength={2} maxLength={80} autoComplete="shipping name" /></Field><Field label="Mobile number"><input {...input('phone')} type="tel" required pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10 digit mobile number" autoComplete="shipping tel-national" /></Field><div className="span-2"><Field label="Street address"><input {...input('line1')} required minLength={5} maxLength={250} placeholder="House number, street, area" autoComplete="shipping street-address" /></Field></div><Field label="City"><input {...input('city')} required maxLength={80} autoComplete="shipping address-level2" /></Field><Field label="State"><input {...input('state')} required maxLength={80} autoComplete="shipping address-level1" /></Field><Field label="PIN code"><input {...input('pinCode')} required pattern="[1-9][0-9]{5}" maxLength={6} inputMode="numeric" autoComplete="shipping postal-code" /></Field><Field label="Country"><input value="India" readOnly autoComplete="shipping country-name" /></Field></div></section><section className="panel"><div className="number-heading"><span>02</span><h2>A simple way to pay</h2></div><div className="payment-choice"><span className="radio-selected"><Check size={12} /></span><div><strong>Cash on delivery</strong><p>Pay the courier when your order arrives.</p></div><PackageCheck size={25} strokeWidth={1.4} /></div><p className="fine-print">No payment is taken online. Your order total is payable on delivery.</p></section><Link className="text-link" to="/shop">← Back to the collection</Link></div><aside className="order-summary"><h2>The good choices</h2>{items.map(item => { const p = store.products.find(p => p.productId === item.productId); return <div className="summary-item" key={item.productId + item.size}><Picture src={p?.image || '/image-fallback.svg'} alt={p?.productName || 'Product'} /><div><strong>{p?.productName || item.productId}</strong><small>{p?.color} / {item.size} / Qty {item.quantity}</small></div><span>{money((p?.productPrice || 0) * item.quantity)}</span></div>; })}<div className="coupon-form"><label className="sr-only" htmlFor="coupon-code">Coupon code</label><Tag size={16} /><input id="coupon-code" value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} placeholder="Have a little extra? Add a code" maxLength={24} /><button type="button" disabled={!coupon.trim() || quoteBusy} onClick={() => { if (applied === coupon.trim()) return; setApplied(coupon.trim()); }}>Apply</button></div>{applied && <div className="applied-code"><span>{quote ? 'Applied: ' : 'Code: '}{applied}</span><button type="button" className="icon-btn" aria-label="Remove coupon" onClick={() => { setApplied(''); setCoupon(''); }}><X size={14} /></button></div>}<ErrorNote message={error} />{quoteBusy && <p className="muted">Checking prices and availability…</p>}{quote && <div className="summary-totals"><div><span>Subtotal</span><span>{money(quote.subtotal)}</span></div>{quote.discount > 0 && <div className="discount-line"><span>Your discount</span><span>−{money(quote.discount)}</span></div>}<div><span>Delivery</span><span>{quote.delivery ? money(quote.delivery) : 'On us'}</span></div><div className="final-total"><strong>Total</strong><strong>{money(quote.total)}</strong></div></div>}<button className="btn dark full" disabled={busy || quoteBusy || !quote}>{busy ? 'Placing your order…' : 'Place order'}<ArrowRight size={17} /></button><p className="security-copy"><LockKeyhole size={13} /> Prices and stock confirmed securely by the store.</p></aside></form></div>;
}

export function OrderSuccess() {
  const { id } = useParams(), { user, sessionLoading, setAuth } = useStore();
  const [order, setOrder] = useState<Order | null>(null), [error, setError] = useState('');
  useEffect(() => { if (user) api<Order[]>('/api/orders').then(rows => { const found = rows.find(o => o.orderId === id); if (found) setOrder(found); else setError('This order could not be found in your account.'); }).catch(e => setError(e.message)); }, [id, user]);
  if (sessionLoading) return <Loading />;
  if (!user) return <div className="empty"><h2>Log in to view your order.</h2><button className="btn dark" onClick={() => setAuth('login')}>Log in</button></div>;
  if (error) return <Empty title="We could not find that order." text={error} to="/account" action="View your orders" />;
  if (!order) return <Loading />;
  return <div className="success-page"><div className="success-icon"><CheckCircle2 size={40} strokeWidth={1.4} /></div><span className="eyebrow">GOOD CHOICE. GREAT DAYS AHEAD.</span><h1>You're all <em>set.</em></h1><p>Your order is in. We'll get your new favourites ready.</p><div className="receipt"><div><span>Order number</span><strong>{order.orderId}</strong></div><div><span>Placed on</span><span>{date(order.createdAt)}</span></div><div><span>Payment</span><span>Cash on delivery</span></div><div><span>Total on delivery</span><strong>{money(order.total)}</strong></div><div><span>Delivery to</span><span>{order.address.city}, {order.address.pinCode}</span></div></div><p className="muted">Track progress and manage this order in your account.</p><div className="button-row"><Link className="btn dark" to="/account?tab=orders">View my orders <ArrowRight size={16} /></Link><Link className="btn outline" to="/shop">Keep exploring</Link></div></div>;
}
