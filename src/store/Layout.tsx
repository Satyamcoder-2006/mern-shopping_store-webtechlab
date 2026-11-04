import React, { useEffect, useState } from 'react';

import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { ArrowUpRight, ArrowRight, Search, UserRound, Heart, ShoppingBag, Menu, X, Minus, Plus, Trash2, LogOut, LayoutDashboard } from 'lucide-react';

import { useStore } from './StoreContext';

import { CartSuggestions } from './Wardrobe';
import { money } from './types';

import { Modal, Picture } from './ui';

export function Header() {

  const store = useStore(), navigate = useNavigate(), location = useLocation();

  const [menu, setMenu] = useState(false), [scrolled, setScrolled] = useState(false);
  const bagCount = store.bag.reduce((sum, item) => sum + item.quantity, 0);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenu(false); }, [location.pathname, location.search]);

  return <><div className="announcement"><span>Good clothes. No overthinking.</span><span>Free shipping on orders ₹1,999+ <ArrowUpRight size={12} /></span></div><header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}><Link className="wordmark" to="/" aria-label="FORME home">forme<span>®</span></Link><nav className="desktop-nav" aria-label="Main navigation"><NavLink to="/shop">The collection</NavLink><Link to="/shop?gender=Women">Women</Link><Link to="/shop?gender=Men">Men</Link><Link to="/community">Outfit face-off</Link><a href="/#our-story">Our story</a></nav><div className="header-actions"><button className="icon-btn search-btn" aria-label="Search collection" onClick={() => navigate('/shop?search=1')}><Search size={20} /></button><Link to="/shop?saved=1" className="icon-btn saved-btn" aria-label={`Wishlist, ${store.wishlist.length} saved pieces`}><Heart size={20} />{store.wishlist.length > 0 && <i />}</Link><button className="icon-btn" aria-label={store.user?.role === 'admin' ? 'Admin studio' : store.user ? 'Your account' : 'Log in'} onClick={() => store.user ? navigate(store.user.role === 'admin' ? '/admin' : '/account') : store.setAuth('login')}><UserRound size={20} /></button><button className="bag-button" aria-label={`Open shopping bag, ${bagCount} items`} onClick={() => store.setBagOpen(true)}><ShoppingBag size={19} /><span className="bag-word">Bag</span>{bagCount > 0 && <span className="bag-count" key={bagCount}>{bagCount}</span>}</button><button className="icon-btn mobile-menu-btn" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X size={22} /> : <Menu size={22} />}</button></div></header>{menu && <nav className="mobile-nav" aria-label="Mobile navigation"><Link to="/shop">Shop all <ArrowUpRight /></Link><Link to="/shop?gender=Women">Women <ArrowUpRight /></Link><Link to="/shop?gender=Men">Men <ArrowUpRight /></Link><Link to="/shop?saved=1">Saved pieces <Heart /></Link><Link to="/community">Outfit face-off <ArrowUpRight /></Link>{store.user?.role === 'admin' && <Link to="/admin">Admin studio <LayoutDashboard /></Link>}</nav>}</>;

}

export function Footer() {

  const { user, setAuth } = useStore();
  const navigate = useNavigate();

  return <footer className="footer"><div className="footer-top"><div><Link to="/" className="wordmark">forme<span>®</span></Link><p>Wear your own rhythm.<br />Good clothes for wherever life takes you.</p></div><div><h3>The wardrobe</h3><Link to="/shop">Shop all</Link><Link to="/shop?category=Tops">Everyday tops</Link><Link to="/shop?category=Layers">The layering edit</Link></div><div><h3>Your corner</h3><button onClick={() => user ? navigate(user.role === 'admin' ? '/admin' : '/account') : setAuth('login')}>{user?.role === 'admin' ? 'Admin studio' : 'My account'}</button><Link to="/account">Orders & tracking</Link><Link to="/shop?saved=1">Saved pieces</Link><Link to="/community">Outfit face-off</Link></div><div className="footer-note"><span className="eyebrow">A little less, a little better.</span><p>Pieces to reach for.<br />Days to make your own.</p><Link to="/shop" className="circle-link" aria-label="Explore the collection"><ArrowUpRight size={25} /></Link></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} FORME. Made for the everyday.</span><span>India · INR ₹</span><span>Cash on delivery · Secure account access</span></div></footer>;

}

export function Bag() {

  const { bag, setBag, bagOpen, setBagOpen, products } = useStore(), navigate = useNavigate();

  if (!bagOpen) return null;

  const subtotal = bag.reduce((sum, i) => sum + (products.find(p => p.productId === i.productId)?.productPrice || 0) * i.quantity, 0);

  const remove = (productId: string, size: string) => setBag(prev => prev.filter(i => !(i.productId === productId && i.size === size)));

  return <Modal title={`Your bag (${bag.reduce((n, i) => n + i.quantity, 0)})`} close={() => setBagOpen(false)} drawer><p className="bag-intro">A few good choices. All yours.</p>{bag.length ? <><div className="shipping-progress"><p>{subtotal >= 1999 ? 'Your delivery is on us.' : `${money(Math.max(0, 1999 - subtotal))} away from free shipping`}</p><div><span style={{ width: `${Math.min(100, subtotal / 1999 * 100)}%` }} /></div></div><div className="bag-items">{bag.map(item => {

    const p = products.find(p => p.productId === item.productId), available = p?.variants.find(v => v.size === item.size)?.stock || 0;

    return <div className="bag-item" key={`${item.productId}-${item.size}`}><Picture src={p?.image || '/image-fallback.svg'} alt={p?.productName || 'Unavailable item'} /><div><Link to={`/product/${item.productId}`} onClick={() => setBagOpen(false)}>{p?.productName || 'Item no longer available'}</Link><p>{p?.color} / Size {item.size}</p><strong>{money((p?.productPrice || 0) * item.quantity)}</strong>{available < item.quantity && <small className="error-text">Update this item before checkout.</small>}<div className="bag-row"><div className="stepper"><button aria-label="Decrease quantity" onClick={() => item.quantity === 1 ? remove(item.productId, item.size) : setBag(prev => prev.map(i => i === item ? { ...i, quantity: i.quantity - 1 } : i))}><Minus size={13} /></button><span>{item.quantity}</span><button aria-label="Increase quantity" disabled={item.quantity >= Math.min(available, 10)} onClick={() => setBag(prev => prev.map(i => i === item ? { ...i, quantity: i.quantity + 1 } : i))}><Plus size={13} /></button></div><button className="icon-btn" aria-label={`Remove ${p?.productName || 'item'}`} onClick={() => remove(item.productId, item.size)}><Trash2 size={16} /></button></div></div></div>;

  })}</div><CartSuggestions /><div className="bag-bottom"><div className="total-line"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>Delivery and discounts confirmed at checkout.</p><button className="btn dark full" onClick={() => { setBagOpen(false); navigate('/checkout'); }}>Checkout <ArrowRight size={17} /></button><button className="text-link" onClick={() => setBagOpen(false)}>Keep exploring</button></div></> : <div className="empty"><ShoppingBag size={42} strokeWidth={1} /><h3>Room for something good.</h3><p>Your bag is waiting for its first favourite.</p><button className="btn dark" onClick={() => { setBagOpen(false); navigate('/shop'); }}>Explore the collection <ArrowRight size={16} /></button></div>}</Modal>;

}

