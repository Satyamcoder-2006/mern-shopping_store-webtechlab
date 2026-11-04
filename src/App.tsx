import React, { useEffect } from 'react';

import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

import { StoreProvider } from './store/StoreContext';

import { Header, Footer, Bag } from './store/Layout';

import Auth from './store/Auth';
import GoogleCallback from './store/GoogleCallback';

import { Home, Shop, ProductDetail } from './store/Catalogue';

import { Checkout, OrderSuccess } from './store/Checkout';

import Account from './store/Account';

import Admin from './store/Admin';

import Community from './store/Community';
import Moderation from './store/Moderation';

import { Empty } from './store/ui';
import { useScrollReveals } from './utils/useScrollReveals';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {

  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() { return this.state.failed ? <div className="empty"><h1>A little pause.</h1><p>The page needs a fresh start. Your account and orders are safe.</p><button className="btn dark" onClick={() => window.location.reload()}>Refresh the page</button></div> : this.props.children; }

}

function Pages() {

  const location = useLocation();
  useScrollReveals();

  useEffect(() => { if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);

  return <><a href="#main-content" className="skip-link">Skip to content</a><Header /><main id="main-content"><Routes><Route path="/" element={<Home />} /><Route path="/auth/callback" element={<GoogleCallback />} /><Route path="/shop" element={<Shop />} /><Route path="/product/:id" element={<ProductDetail />} /><Route path="/community" element={<Community />} /><Route path="/admin/community" element={<Moderation />} /><Route path="/checkout" element={<Checkout />} /><Route path="/order/:id" element={<OrderSuccess />} /><Route path="/account" element={<Account />} /><Route path="/admin" element={<Admin />} /><Route path="*" element={<Empty title="A little off the beaten path." text="This page is not in our edit. Let's get you back to something good." to="/" action="Back to FORME" />} /></Routes></main>{location.pathname !== '/admin' && <Footer />}<Bag /><Auth /></>;

}

export default function App() { return <ErrorBoundary><BrowserRouter><StoreProvider><Pages /></StoreProvider></BrowserRouter></ErrorBoundary>; }

