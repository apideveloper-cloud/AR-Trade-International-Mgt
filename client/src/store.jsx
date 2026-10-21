import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken, tk } from './api.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

function usePersisted(key, init, storage = 'localStorage') {
  const [v, setV] = useState(() => {
    try { const s = JSON.parse(window[storage].getItem(key)); return s ?? init; } catch { return init; }
  });
  useEffect(() => { try { window[storage].setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } }, [key, storage, v]);
  return [v, setV];
}

/** Same pricing rules as the design's AR.totals; the server recomputes everything when the order is placed. */
export function computeTotals(cartLines, site, { area = 'inside', coupon = '', express = false, partial = 'split', member = false } = {}) {
  const lines = cartLines.map(({ p, qty }) => {
    const avail = Math.max(0, Math.min(qty, p.stock || 0));
    const short = qty - avail;
    return { ...p, qty, avail, short, held: p.price >= 100000, chargeQty: partial === 'drop' ? avail : qty };
  });
  const subtotal = lines.reduce((a, l) => a + l.price * l.chargeQty, 0);
  const saved = lines.reduce((a, l) => a + Math.max(0, (l.old || l.price) - l.price) * l.chargeQty, 0);
  const cu = coupon.trim().toUpperCase();
  const welcome = cu === 'WELCOME10';
  const okCoupon = !!cu && (cu === String(site.coupon).toUpperCase() || welcome);
  const discount = okCoupon ? Math.round(subtotal * (welcome ? 10 : site.couponPct) / 100) : 0;
  const memberPct = member ? site.memberPct : 0;
  const memberOff = Math.round((subtotal - discount) * memberPct / 100);
  const base = area === 'outside' ? site.outsideFee : area === 'suburb' ? site.suburbFee : site.insideFee;
  const freeElig = area !== 'outside' && subtotal >= site.freeOver;
  const expressFee = express && area === 'inside' ? site.expressFee : 0;
  const delivery = subtotal ? (freeElig ? 0 : base) + expressFee : 0;
  const total = Math.max(0, subtotal - discount - memberOff + delivery);
  const vat = Math.round(total * site.vatPct / (100 + site.vatPct));
  return {
    lines, subtotal, saved, discount, member: memberOff, memberPct, delivery, express: expressFee, base, freeOver: site.freeOver, freeElig,
    freeLeft: area === 'outside' ? 0 : Math.max(0, site.freeOver - subtotal), zone: area, total, vat, vatPct: site.vatPct, okCoupon,
    heldN: lines.filter(l => l.held).length, shortN: lines.filter(l => l.short > 0).length, count: lines.reduce((a, l) => a + l.qty, 0)
  };
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [cart, setCart] = usePersisted('ar_cart', {});
  const [wish, setWish] = usePersisted('ar_wish', []);
  const [compare, setCompare] = usePersisted('ar_compare', []);
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [optMail, setOptMail] = useState(null); // { email, token, open, confirmed }
  const [subscribed, setSubscribed] = useState(false);
  const timer = useRef();

  useEffect(() => {
    api.get('/bootstrap').then(setData).catch(e => setError(e.message));
    if (getToken()) api.get('/auth/me').then(r => setUser(r.user)).catch(() => setToken(null));
  }, []);

  const say = useCallback((text, link) => {
    setToast({ text, link });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const byId = useMemo(() => new Map((data?.products || []).map(p => [p.id, p])), [data]);
  const find = id => byId.get(Number(id));

  const addToCart = (p, n = 1) => {
    if (!p.price) return say('This product needs a quotation — ask us on WhatsApp');
    setCart(c => ({ ...c, [p.id]: (c[p.id] || 0) + n }));
    say('Added: ' + p.name, '/cart');
  };
  const setQty = (id, n) => setCart(c => { const x = { ...c }; if (n <= 0) delete x[id]; else x[id] = n; return x; });
  const clearCart = () => setCart({});
  const toggleWish = id => setWish(w => (w.includes(id) ? w.filter(x => x !== id) : [...w, id]));
  const toggleCompare = id => {
    if (compare.includes(id)) return setCompare(compare.filter(x => x !== id));
    if (compare.length >= 3) return say('Compare holds up to 3 products');
    setCompare([...compare, id]);
  };

  const cartLines = Object.entries(cart).map(([id, qty]) => ({ p: find(id), qty })).filter(l => l.p);
  const cartCount = cartLines.reduce((a, l) => a + l.qty, 0);
  const cartSubtotal = cartLines.reduce((a, l) => a + l.p.price * l.qty, 0);

  const auth = async (path, body) => {
    const r = await api.post('/auth/' + path, body);
    setToken(true); setUser(r.user);
    return r.user;
  };
  const logout = () => { setToken(null); setUser(null); api.post('/auth/logout').catch(() => {}); };

  /** Starts the double opt-in flow: the (demo) confirmation mail is opened from a toast. */
  const optIn = async (email, source) => {
    const r = await api.post('/optin', { email, source });
    if (r.status === 'Confirmed') { setSubscribed(true); say('You are already subscribed'); return r; }
    setOptMail({ email: r.email, token: r.token, open: false, confirmed: false });
    setSubscribed(true);
    return r;
  };
  const confirmOptIn = async () => {
    if (!optMail) return;
    await api.post('/optin/confirm', { token: optMail.token });
    setOptMail(m => ({ ...m, confirmed: true }));
  };

  const value = {
    data, error, cats: data?.cats || [], products: data?.products || [], site: data?.site, content: data?.content, find,
    cart, cartLines, cartCount, cartSubtotal, addToCart, setQty, clearCart,
    wish, toggleWish, compare, setCompare, toggleCompare,
    user, setUser, login: b => auth('login', b), register: b => auth('register', b), social: b => auth('social', b), logout,
    toast, say, cartOpen, setCartOpen, loginOpen, setLoginOpen,
    optMail, setOptMail, optIn, confirmOptIn, subscribed,
    totals: opts => computeTotals(cartLines, data.site, { member: !!user, ...opts }),
    tk: s => tk(s, data?.site || {})
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
