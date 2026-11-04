import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Modal({ title, children, close, wide = false, drawer = false }: { title: string; children: React.ReactNode; close: () => void; wide?: boolean; drawer?: boolean }) {
  const ref = useRef<HTMLDivElement>(null), id = useId();
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    const active = document.activeElement as HTMLElement, before = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const fields = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, a[href], [tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
        const first = fields[0], last = fields[fields.length - 1];
        if (!fields.length) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = before; document.removeEventListener('keydown', key); active?.focus(); };
  }, []);
  return createPortal(<div className={`modal-layer ${drawer ? 'drawer-layer' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className={`modal ${wide ? 'modal-wide' : ''} ${drawer ? 'drawer' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}><div className="modal-head"><h2 id={id}>{title}</h2><button className="icon-btn" aria-label="Close dialog" onClick={close}><X size={21} /></button></div>{children}</div></div>, document.body);
}
export function Picture({ src, alt, className = '', eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return <img src={src} alt={alt} className={className} loading={eager ? 'eager' : 'lazy'} onError={e => { const image = e.currentTarget; if (!image.src.endsWith('/image-fallback.svg')) image.src = '/image-fallback.svg'; }} />;
}
export function Empty({ title, text, action = 'Explore the collection', to = '/shop' }: { title: string; text: string; action?: string; to?: string }) {
  return <div className="empty"><ShoppingBag size={35} strokeWidth={1} /><h2>{title}</h2><p>{text}</p><Link className="btn dark" to={to}>{action}<ArrowRight size={17} /></Link></div>;
}
export function ErrorNote({ message }: { message?: string }) { return message ? <p className="error-note" role="alert">{message}</p> : null; }
export function Loading() { return <div className="loading" role="status"><span className="spinner" />Finding your next favourite…</div>; }
export function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
