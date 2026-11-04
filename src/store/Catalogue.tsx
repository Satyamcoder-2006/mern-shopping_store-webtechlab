import React, { useState, useRef, useEffect } from 'react';

import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { motion, useReducedMotion } from 'motion/react';

import { ArrowUpRight, ArrowRight, Heart, Plus, Minus, Truck, PackageCheck, MoveUpRight, Search, SlidersHorizontal, Check } from 'lucide-react';

import { useStore } from './StoreContext';

import { api } from './api';

import { money, type Product } from './types';

import { Empty, ErrorNote, Picture, Loading, Modal } from './ui';

import { SizeRecommender, ProductReviews } from './Wardrobe';



const swatchColor = (color: string) => ({ Chalk: '#dedbd0', Sand: '#cdbd9f', Stone: '#c0b8a3', Olive: '#6e7250', Oat: '#c2b89c', Clay: '#bb8972', Indigo: '#48536f', Ink: '#333b38' } as Record<string, string>)[color] || '#b3ad9d';

export function ProductCard({ product: p }: { product: Product }) {

  const { wishlist, toggleWish } = useStore();

  return <article className="product-card" data-reveal><div className="product-photo"><Link to={`/product/${p.productId}`} aria-label={`View ${p.productName}`}><Picture src={p.image} alt={`${p.productName} in ${p.color}`} /></Link>{p.badge && <span className="product-badge">{p.badge}</span>}<button className={`wish-button ${wishlist.includes(p.productId) ? 'saved' : ''}`} aria-label={`${wishlist.includes(p.productId) ? 'Unsave' : 'Save'} ${p.productName}`} aria-pressed={wishlist.includes(p.productId)} onClick={() => toggleWish(p.productId)}><Heart size={17} /></button><Link className="quick-view" to={`/product/${p.productId}`}>{p.quantity > 0 ? 'Find your fit' : 'View piece'}<Plus size={16} /></Link></div><div className="product-caption"><div><span className="product-type">{p.category} / {p.gender}</span><h3><Link className="product-card-link" to={`/product/${p.productId}`}>{p.productName}</Link></h3><span className="product-color"><i style={{ background: swatchColor(p.color) }} />{p.color}{p.quantity === 0 && ' · Sold out'}</span></div><div className="product-price"><strong>{money(p.productPrice)}</strong>{p.originalPrice && p.originalPrice > p.productPrice && <><del>{money(p.originalPrice)}</del><span className="discount-pill">-{Math.round((1 - p.productPrice / p.originalPrice) * 100)}%</span></>}</div></div></article>;

}



export function Home() {

  const { products, loading, productError, refreshProducts } = useStore(), reduced = useReducedMotion();

  const heroRef = useRef<HTMLDivElement>(null);

  const reveal = { initial: { opacity: 0, y: reduced ? 0 : 14 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: reduced ? 0 : .5 } };

  return <><section className="hero"><div className="hero-copy"><span className="eyebrow"><span className="live-dot" /> THE EVERYDAY EDIT · VOL. 01</span><motion.h1 initial={{ opacity: 0, y: reduced ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .5 }}>Less noise.<br /><em>More you.</em></motion.h1><p>Considered essentials. Effortless fits.<br />A wardrobe that moves to your rhythm.</p><div className="hero-cta"><Link className="btn dark" to="/shop">Find your everyday <ArrowUpRight size={19} /></Link><span>Wear it your way.</span></div><div className="hero-bottom"><span>DESIGNED FOR REAL LIFE</span><span>01 — FOREVER IN ROTATION</span></div></div><div className="hero-visual" ref={heroRef} onPointerMove={e => { if (reduced || e.pointerType === 'touch') return; const box = e.currentTarget.getBoundingClientRect(); heroRef.current?.style.setProperty('--rx', `${(e.clientY - box.top - box.height / 2) / 90}deg`); heroRef.current?.style.setProperty('--ry', `${(box.width / 2 - e.clientX + box.left) / 90}deg`); }} onPointerLeave={() => { heroRef.current?.style.setProperty('--rx', '0deg'); heroRef.current?.style.setProperty('--ry', '0deg'); }}><div className="hero-image"><Picture src="/catalog/campus-136.webp" alt="A regular-length white sweatshirt styled for everyday campus wear" eager /><div className="hero-image-shade" /><span className="hero-image-caption">THE ART OF SHOWING UP<br />AS YOURSELF.</span></div><div className="floating-tag"><span className="tag-symbol">f.</span><div><strong>Good clothes.<br />Great energy.</strong><span>THE FORME PHILOSOPHY</span></div><ArrowUpRight size={24} /></div><span className="vertical-caption">NOT JUST AN OUTFIT. A FEELING.</span><div className="hero-sticker">MADE FOR<br /><em>your</em><br />EVERYDAY</div></div></section><div className="ticker" aria-label="Everyday essentials, considered details, your own rhythm"><div className="ticker-track" aria-hidden="true">{[0, 1].map(copy => <div className="ticker-group" key={copy}><span>✳</span> YOUR OWN RHYTHM <span>✳</span> EVERYDAY ESSENTIALS <span>✳</span> CONSIDERED DETAILS</div>)}</div></div><section className="section collection-section"><motion.div {...reveal} className="section-heading"><div><span className="eyebrow">THE GOOD STUFF</span><h2>Meet your new <em>regulars.</em></h2></div><Link className="underlined" to="/shop">Shop the collection <ArrowUpRight size={17} /></Link></motion.div>{productError ? <div className="empty"><ErrorNote message={productError} /><button className="btn outline" onClick={refreshProducts}>Try again</button></div> : loading ? <Loading /> : products.length ? <div className="product-grid">{products.slice(0, 4).map(p => <ProductCard key={p.productId} product={p} />)}</div> : <Empty title="A new edit is on its way." text="Our next collection will be here soon." />}</section><section className="section category-section"><motion.div {...reveal} className="section-heading"><div><span className="eyebrow">NO RULES. JUST YOU.</span><h2>Build your <em>own uniform.</em></h2></div><p>Start with what feels right.</p></motion.div><div className="category-grid">{[

    { title: 'The everyday top', sub: 'The foundation of a good day.', cat: 'Tops', image: '/catalog/campus-116.webp' },

    { title: 'Room to move', sub: 'Easy fits. A little more freedom.', cat: 'Bottoms', image: '/catalog/campus-131.webp' },

    { title: 'A layer of you', sub: 'The finishing touch, on your terms.', cat: 'Layers', image: '/catalog/campus-127.webp' },

  ].map(c => <Link key={c.cat} className="category-tile" data-reveal to={`/shop?category=${c.cat}`}><Picture src={c.image} alt={c.title} /><div><span className="eyebrow">{c.cat}</span><h3>{c.title}</h3><p>{c.sub}</p></div><span className="tile-arrow"><ArrowUpRight size={22} /></span></Link>)}</div></section><section className="story-section" id="our-story"><div className="story-art" data-reveal><Picture src="/catalog/campus-125.webp" alt="A full-sleeve bomber jacket for everyday layering" /><span className="story-mark">f.</span></div><div className="story-copy" data-reveal><span className="eyebrow">A NOTE FROM FORME</span><h2>You don't need<br />more clothes.<br /><em>Just more you.</em></h2><p>We believe getting dressed should feel easy. So we keep things considered: versatile shapes, thoughtful details, and pieces you can make your own.</p><p>No dress code. No chasing the next thing. Just good clothes for the life you're already living.</p><Link to="/shop" className="underlined">Get to know the collection <ArrowUpRight size={17} /></Link></div></section><section className="service-strip"><div><Truck size={23} strokeWidth={1.5} /><span><strong>A little closer to your door</strong><small>Free shipping on orders ₹1,999+</small></span></div><div><PackageCheck size={23} strokeWidth={1.5} /><span><strong>Pay when it arrives</strong><small>Cash on delivery across India</small></span></div><div><Heart size={23} strokeWidth={1.5} /><span><strong>Your favourites, in one place</strong><small>Save the pieces you keep coming back to</small></span></div></section><section className="closing-banner" data-reveal><span className="eyebrow">SAME YOU. NEW FAVOURITES.</span><h2>Get dressed.<br /><em>Be yourself.</em></h2><Link className="btn light" to="/shop">Make it your own <ArrowUpRight size={19} /></Link><span className="closing-watermark">forme.</span></section></>;

}



export function Shop() {

  const { products, loading, productError, wishlist, refreshProducts } = useStore(), [params, setParams] = useSearchParams();

  const [sort, setSort] = useState('featured'), [query, setQuery] = useState('');

  const category = params.get('category') || 'All', gender = params.get('gender') || 'All', saved = params.get('saved') === '1';

  const setFilter = (key: string, value: string) => { const next = new URLSearchParams(params); value === 'All' ? next.delete(key) : next.set(key, value); setParams(next); };

  const result = products.filter(p => (category === 'All' || p.category === category) && (gender === 'All' || p.gender === gender || p.gender === 'Unisex') && (!saved || wishlist.includes(p.productId)) && `${p.productName} ${p.category} ${p.color}`.toLowerCase().includes(query.toLowerCase()));

  result.sort((a, b) => sort === 'low' ? a.productPrice - b.productPrice : sort === 'high' ? b.productPrice - a.productPrice : Number(b.featured) - Number(a.featured));

  return <div className="shop-page"><div className="shop-intro"><div><span className="eyebrow">{saved ? 'YOUR PERSONAL EDIT' : `${gender === 'All' ? 'THE' : gender.toUpperCase() + ' / THE'} FORME COLLECTION`}</span><h1>{saved ? 'Saved for ' : 'Good clothes for '}<em>{saved ? 'you.' : 'real life.'}</em></h1><p>{saved ? 'The pieces that caught your eye. Still very much your style.' : 'The pieces you reach for. The ones you make your own.'}</p></div><span className="shop-index">{String(result.length).padStart(2, '0')}<small>CONSIDERED PIECES</small></span></div><div className="shop-tools"><div className="category-pills">{['All', 'Tops', 'Bottoms', 'Layers', 'Sets'].map(cat => <button key={cat} className={cat === category ? 'selected' : ''} onClick={() => setFilter('category', cat)}>{cat === 'All' ? 'All pieces' : cat}</button>)}</div><div className="shop-selects"><label className="search-field"><Search size={16} /><input aria-label="Search products" placeholder="Find your piece…" value={query} onChange={e => setQuery(e.target.value)} autoFocus={params.get('search') === '1'} /></label><select aria-label="Collection" value={gender} onChange={e => setFilter('gender', e.target.value)}><option value="All">Everyone</option><option>Women</option><option>Men</option></select><select aria-label="Sort products" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Our edit</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div></div>{productError ? <div className="empty"><ErrorNote message={productError} /><button className="btn dark" onClick={refreshProducts}>Try again</button></div> : loading ? <Loading /> : result.length ? <><div className="shop-count">{result.length} pieces. Endless possibilities.</div><div className="product-grid">{result.map(p => <ProductCard key={p.productId} product={p} />)}</div><div className="end-of-edit"><span>YOU'VE MET THE EDIT.</span><p>Now make it your own.</p></div></> : <Empty title={saved ? 'Your favourites start here.' : 'Nothing in this edit just yet.'} text="Try another category or explore the full collection." />}</div>;

}



export function ProductDetail() {

  const { id } = useParams(), store = useStore(), navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null), [error, setError] = useState(''), [size, setSize] = useState(''), [quantity, setQuantity] = useState(1), [guide, setGuide] = useState(false), [sizeError, setSizeError] = useState(false);

  useEffect(() => { setProduct(null); setError(''); setSize(''); setQuantity(1); setSizeError(false); api<Product>(`/api/products/${encodeURIComponent(id || '')}`).then(setProduct).catch(e => setError(e.message)); }, [id]);

  if (error) return <div className="section"><Empty title="This piece has left the edit." text={error} /></div>;

  if (!product) return <Loading />;

  const p = product, stock = p.variants.find(v => v.size === size)?.stock || 0;

  const buy = () => { if (!size || stock < quantity) { setSizeError(!size); setError(''); store.toast('Choose your size first.'); return; } navigate('/checkout', { state: { buyNow: { productId: p.productId, size, quantity } } }); };

  const chooseSize = (next: string) => { setSize(next); setSizeError(false); setQuantity(1); };
  const addToBag = () => {
    if (!size) { setSizeError(true); return; }
    if (store.addToBag(p, size, quantity)) store.setBagOpen(true);
  };

  return <div className="product-page"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/shop">The collection</Link><span>/</span><Link to={`/shop?category=${p.category}`}>{p.category}</Link><span>/</span><span>{p.productName}</span></nav><div className="product-layout"><div className="detail-gallery"><div className="detail-gallery-images"><Picture src={p.image} alt={`${p.productName} in ${p.color}`} eager />{p.images?.filter(image => image !== p.image).map(image => <Picture src={image} alt={`${p.productName} alternate view`} key={image} />)}</div><span className="detail-image-label">FORME / {p.productId}</span></div><div className="detail-info"><span className="eyebrow">{p.badge || 'THE EVERYDAY EDIT'}</span><h1>{p.productName}</h1><p className="detail-gender">{p.gender} · {p.category}</p><div className="detail-price"><strong>{money(p.productPrice)}</strong>{p.originalPrice && <del>{money(p.originalPrice)}</del>}<span>Inclusive of all taxes</span></div><p className="detail-description">{p.description}</p><div className="colour-label">Colour <strong><i className="colour-swatch" style={{ background: swatchColor(p.color) }} />{p.color}</strong></div><div className="size-heading"><span>Select your size</span><button className="text-link" onClick={() => setGuide(true)}>Size guide <MoveUpRight size={13} /></button></div><SizeRecommender product={p} choose={chooseSize} /><div className="sizes" role="group" aria-label="Select your size" aria-describedby={sizeError ? "size-error" : undefined}>{p.variants.map(v => <button key={v.size} disabled={v.stock === 0} aria-pressed={size === v.size} className={size === v.size ? 'selected' : ''} onClick={() => chooseSize(v.size)}>{v.size}{!v.stock && <span className="sr-only"> Sold out</span>}</button>)}</div>{sizeError && <p className="size-error" id="size-error" role="alert">Please select a size.</p>}<p className="stock-note">{!p.quantity ? 'This piece is currently sold out.' : size ? stock <= 3 ? `Only ${stock} left in this size.` : 'In stock. Ready for your everyday.' : 'Choose the fit that feels like you.'}</p><div className="detail-add"><div className="stepper"><button aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}><Minus size={15} /></button><span>{quantity}</span><button aria-label="Increase quantity" disabled={!size || quantity >= Math.min(stock, 10)} onClick={() => setQuantity(quantity + 1)}><Plus size={15} /></button></div><button className="btn dark" disabled={!p.quantity} onClick={addToBag}>Add to bag <Plus size={17} /></button><button className={`icon-btn detail-wish ${store.wishlist.includes(p.productId) ? 'saved' : ''}`} aria-label="Save this piece" aria-pressed={store.wishlist.includes(p.productId)} onClick={() => store.toggleWish(p.productId)}><Heart size={20} /></button></div><p className="purchase-trust">Free shipping over ₹1,999 · Cash on delivery</p><button className="btn outline full" disabled={!p.quantity} onClick={buy}>Buy now <ArrowRight size={17} /></button><div className="detail-services"><span><Truck size={17} />Free delivery on orders ₹1,999+</span><span><PackageCheck size={17} />Cash on delivery available</span></div><details open><summary>The details</summary><p>{p.material}</p><p>Available stock: {p.quantity} across sizes. Product {p.productId}.</p></details><details><summary>A little care goes a long way</summary><p>{p.care}</p></details><details><summary>Delivery</summary><p>Delivery is available within India. Shipping is ₹99, or free on orders of ₹1,999 and above. You can track order progress from your account.</p></details></div></div><div className="mobile-buy-bar" aria-label="Quick add to bag"><strong>{money(p.productPrice)}</strong><button className="btn dark" disabled={!p.quantity} onClick={addToBag}>Add to bag <Plus size={17} /></button>{sizeError && <span role="status">Please select a size above.</span>}</div><ProductReviews key={p.productId} product={p} /><section className="related"><div className="section-heading"><h2>In good <em>company.</em></h2><Link className="underlined" to="/shop">Back to the edit <ArrowUpRight size={17} /></Link></div><div className="product-grid">{store.products.filter(other => other.productId !== p.productId).slice(0, 4).map(other => <ProductCard key={other.productId} product={other} />)}</div></section>{guide && <Modal title="Find your fit" close={() => setGuide(false)}><p className="muted">Approximate body measurements in inches. These are general fit guidelines; individual styles may vary.</p><table className="data-table"><thead><tr><th>Size</th><th>Chest</th><th>Waist</th></tr></thead><tbody>{[['XS', '32–34', '26–28'], ['S', '35–37', '29–31'], ['M', '38–40', '32–34'], ['L', '41–43', '35–37'], ['XL', '44–46', '38–40']].map(row => <tr key={row[0]}>{row.map(v => <td key={v}>{v}</td>)}</tr>)}</tbody></table><p className="muted">For a relaxed silhouette, choose your usual size. Prefer an oversized feel? Go one size up.</p></Modal>}</div>;

}

