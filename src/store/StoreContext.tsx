import React, { createContext, useContext, useEffect, useState } from 'react';
import { signOutGoogle } from './neon';
import { api, setCsrf } from './api';
import type { Product, Customer, BagItem } from './types';
type Store = {
  products: Product[]; loading: boolean; productError: string; refreshProducts: () => Promise<void>;
  user: Customer | null; sessionLoading: boolean; setUser: (u: Customer | null) => void;
  auth: 'login' | 'signup' | null; setAuth: (mode: 'login' | 'signup' | null) => void;
  bag: BagItem[]; setBag: React.Dispatch<React.SetStateAction<BagItem[]>>; bagOpen: boolean; setBagOpen: (open: boolean) => void;
  addToBag: (p: Product, size: string, quantity?: number) => boolean; wishlist: string[]; toggleWish: (id: string) => void;
  toast: (message: string) => void; logout: () => Promise<void>;
};
const Context = createContext<Store>(null!);
const stored = (key: string): any[] => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]), [loading, setLoading] = useState(true), [productError, setProductError] = useState('');
  const [user, setUser] = useState<Customer | null>(null), [sessionLoading, setSessionLoading] = useState(true), [auth, setAuth] = useState<Store['auth']>(null);
  const [bag, setBag] = useState<BagItem[]>(() => stored('forme_bag').filter(i => typeof i?.productId === 'string' && ['XS', 'S', 'M', 'L', 'XL'].includes(i.size) && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 10).slice(0, 40));
  const [bagOpen, setBagOpen] = useState(false), [wishlist, setWishlist] = useState<string[]>(() => stored('forme_wishlist').filter(v => typeof v === 'string').slice(0, 100));
  const [notice, setNotice] = useState('');
  const toast = (message: string) => setNotice(message);
  const refreshProducts = async () => { setLoading(true); setProductError(''); try { setProducts(await api('/api/products')); } catch (e) { setProductError((e as Error).message); } finally { setLoading(false); } };
  useEffect(() => { refreshProducts(); api('/api/session').then(data => setUser(data.user)).catch(() => setCsrf('')).finally(() => setSessionLoading(false));
    // Remove credentials left by the earlier lab implementation.
    ['token', 'username', 'emailId'].forEach(k => localStorage.removeItem(k));
    const expired = () => { setUser(null); setCsrf(''); setAuth('login'); };
    window.addEventListener('forme:expired', expired); return () => window.removeEventListener('forme:expired', expired);
  }, []);
  useEffect(() => { localStorage.setItem('forme_bag', JSON.stringify(bag)); }, [bag]);
  useEffect(() => { localStorage.setItem('forme_wishlist', JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  const addToBag = (p: Product, size: string, quantity = 1) => {
    const stock = p.variants.find(v => v.size === size)?.stock || 0;
    const current = bag.find(i => i.productId === p.productId && i.size === size)?.quantity || 0;
    if (!size || current + quantity > stock || current + quantity > 10) { toast('Choose an available size and quantity.'); return false; }
    setBag(prev => { const existing = prev.find(i => i.productId === p.productId && i.size === size); return existing ? prev.map(i => i === existing ? { ...i, quantity: i.quantity + quantity } : i) : [...prev, { productId: p.productId, size, quantity }]; });
    toast('A good choice. Added to your bag.'); return true;
  };
  const toggleWish = (id: string) => setWishlist(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id].slice(0, 100));
  const logout = async () => { await api('/api/logout', 'POST'); await signOutGoogle().catch(() => {}); setUser(null); setCsrf(''); setBag([]); setBagOpen(false); toast('You are logged out. See you soon.'); };
  return <Context.Provider value={{ products, loading, productError, refreshProducts, user, sessionLoading, setUser, auth, setAuth, bag, setBag, bagOpen, setBagOpen, addToBag, wishlist, toggleWish, toast, logout }}>{children}<div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div></Context.Provider>;
}
export const useStore = () => useContext(Context);
