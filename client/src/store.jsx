import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken, tk } from './api.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

function usePersisted(key, init, storage = 'localStorage') {
  const [v, setV] = useState(() => {
    try { const s = JSON.parse(window[storage].getItem(key)); return s != null && typeof s === typeof init && Array.isArray(s) === Array.isArray(init) ? s : init; } catch { return init; } // a damaged or foreign value falls back to the default instead of crashing (wish.includes, Object.entries)
  });
  useEffect(() => { try { window[storage].setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } }, [key, storage, v]);
  return [v, setV];
}

/** Same pricing rules as the design's AR.totals; the server recomputes everything when the order is placed. */
export function computeTotals(cartLines, site, { area = 'inside', deliveryBase, coupon = '', express = false, partial = 'split', member = false } = {}) {
  const lines = cartLines.map(({ p, qty }) => {
    const avail = Math.max(0, Math.min(qty, p.stock || 0));
    const short = qty - avail;
    return { ...p, qty, avail, short, held: p.price >= 100000, chargeQty: partial === 'drop' ? avail : qty };
  });
  const subtotal = lines.reduce((a, l) => a + l.price * l.chargeQty, 0);
  const saved = lines.reduce((a, l) => a + Math.max(0, (l.old || l.price) - l.price) * l.chargeQty, 0);
  const cu = coupon.trim().toUpperCase();
  const welcome = cu === 'WELCOME10';
  const okCoupon = !!cu && ((!!site.coupon && cu === String(site.coupon).toUpperCase()) || welcome); // an empty coupon setting must not make the text "UNDEFINED" valid (the server has the same guard)
  const discount = okCoupon ? Math.round(subtotal * (welcome ? 10 : site.couponPct) / 100) : 0;
  const memberPct = member ? site.memberPct : 0;
  const memberOff = Math.round((subtotal - discount) * memberPct / 100);
  const base = area === 'outside' ? site.outsideFee : area === 'suburb' ? site.suburbFee : (Number.isFinite(deliveryBase) && deliveryBase >= 0 ? deliveryBase : site.insideFee);
  const byMap = area !== 'outside' && Number.isFinite(deliveryBase) && deliveryBase >= 0; // priced from the map: that charge is always added, the free-over-a-spend rule does not apply
  const freeOn = !byMap && Number(site.freeOver) > 0;
  const freeElig = freeOn && area !== 'outside' && subtotal >= site.freeOver;
  const expressFee = express && area === 'inside' ? site.expressFee : 0;
  const delivery = subtotal ? (freeElig ? 0 : base) + expressFee : 0;
  const total = Math.max(0, subtotal - discount - memberOff + delivery);
  const vat = Math.round(total * site.vatPct / (100 + site.vatPct));
  return {
    lines, subtotal, saved, discount, member: memberOff, memberPct, delivery, express: expressFee, base, freeOver: site.freeOver, freeElig,
    freeLeft: !freeOn || area === 'outside' ? 0 : Math.max(0, site.freeOver - subtotal), zone: area, total, vat, vatPct: site.vatPct, okCoupon,
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
  const [authReady, setAuthReady] = useState(() => !getToken()); // false while a remembered sign-in is still being checked with the server
  const [toast, setToast] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [optMail, setOptMail] = useState(null); // { email } while the "check your inbox" toast is showing
  const [subscribed, setSubscribed] = useState(false);
  const timer = useRef();

  useEffect(() => {
    api.get('/bootstrap').then(setData).catch(e => setError(e.message));
    if (getToken()) {
      api.get('/auth/me').then(r => setUser(r.user))
        .catch(e => { if (e.status === 401 || e.status === 403) setToken(null); }) // only a rejected session clears the flag; a network blip must not sign the customer out
        .finally(() => setAuthReady(true));
    }
  }, []);

  useEffect(() => { // any account call answered 401 (session replaced or expired): show the signed-out state instead of an endless spinner
    const ended = () => { setToken(null); setUser(null); };
    window.addEventListener('ar:session-ended', ended);
    return () => window.removeEventListener('ar:session-ended', ended);
  }, []);

  /** Shows a toast. kind: 'success' | 'error' | 'info' | 'cart'; when omitted it is worked out from the text and link. */
  const say = useCallback((text, link, kind) => {
    const t = String(text ?? '');
    const k = kind || (link ? 'cart' : /\b(no longer|cannot|can't|not (set up|valid|look)|wrong|invalid|please|too many|failed|error|unavailable|already|holds up|needs a|allow pop|add an email|did not|does not)\b/i.test(t) ? 'error' : /\b(cancel+ed|sent|saved|subscribed|updated|copied|removed|done|thank)\b/i.test(t) ? 'success' : 'info');
    const ms = k === 'error' ? 4200 : 3200;
    setToast({ id: Date.now() + Math.random(), text: t, link, kind: k, ms });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);
  const dismissToast = useCallback(() => { clearTimeout(timer.current); setToast(null); }, []);

  const byId = useMemo(() => new Map((data?.products || []).map(p => [p.id, p])), [data]);
  const find = useCallback(id => byId.get(Number(id)), [byId]);

  const addToCart = useCallback((p, n = 1) => {
    if (!p.price) return say('This product needs a quotation — ask us on WhatsApp');
    setCart(c => ({ ...c, [p.id]: (c[p.id] || 0) + n }));
    say('Added: ' + p.name, '/cart');
  }, [say, setCart]);
  const setQty = useCallback((id, n) => setCart(c => { const x = { ...c }; if (n <= 0) delete x[id]; else x[id] = n; return x; }), [setCart]);
  const clearCart = useCallback(() => setCart({}), [setCart]);
  const toggleWish = useCallback(id => setWish(w => (w.includes(id) ? w.filter(x => x !== id) : [...w, id])), [setWish]);
  const toggleCompare = useCallback(id => {
    if (compare.includes(id)) return setCompare(compare.filter(x => x !== id));
    if (compare.length >= 3) return say('Compare holds up to 3 products');
    setCompare([...compare, id]);
  }, [compare, say, setCompare]);

  const cartLines = useMemo(() => Object.entries(cart).map(([id, qty]) => ({ p: find(id), qty })).filter(l => l.p), [cart, find]);
  const cartCount = useMemo(() => cartLines.reduce((a, l) => a + l.qty, 0), [cartLines]);
  const cartSubtotal = useMemo(() => cartLines.reduce((a, l) => a + l.p.price * l.qty, 0), [cartLines]);

  const auth = useCallback(async (path, body) => {
    const r = await api.post('/auth/' + path, body);
    setToken(true); setUser(r.user);
    return r.user;
  }, []);
  const login = useCallback(b => auth('login', b), [auth]);
  /** Quick account from a guest order: signs the customer in and returns { user, login: { id, password } }. */
  const autoAccount = useCallback(async (orderId, phone) => { const r = await api.post('/orders/' + encodeURIComponent(orderId) + '/account', { phone }); setToken(true); setUser(r.user); return r; }, []);
  const register = useCallback(b => auth('register', b), [auth]);
  const social = useCallback(b => auth('social', b), [auth]);
  const logout = useCallback(() => { setToken(null); setUser(null); api.post('/auth/logout').catch(() => {}); }, []);

  /** Starts the double opt-in flow: the confirmation link is emailed, and the subscription only counts once it is clicked. */
  const optIn = useCallback(async (email, source) => {
    const r = await api.post('/optin', { email, source });
    if (r.status === 'Confirmed') { setSubscribed(true); say('You are already subscribed'); return r; }
    setOptMail({ email: r.email });
    setSubscribed(true);
    return r;
  }, [say]);

  const site = data?.site;
  const totals = useCallback(opts => computeTotals(cartLines, site, { member: !!user, ...opts }), [cartLines, site, user]);
  const tkSite = useCallback(s => tk(s, site || {}), [site]);

  // One stable object per real change, so consumers only re-render when something they can see actually changed.
  const value = useMemo(() => ({
    data, error, cats: data?.cats || [], products: data?.products || [], site, content: data?.content, find,
    cart, cartLines, cartCount, cartSubtotal, addToCart, setQty, clearCart,
    wish, toggleWish, compare, setCompare, toggleCompare,
    user, setUser, authReady, login, autoAccount, register, social, logout,
    toast, say, dismissToast, cartOpen, setCartOpen, loginOpen, setLoginOpen,
    optMail, setOptMail, optIn, subscribed,
    totals, tk: tkSite
  }), [data, error, site, find, cart, cartLines, cartCount, cartSubtotal, addToCart, setQty, clearCart, wish, toggleWish, compare, setCompare, toggleCompare,
    user, authReady, login, register, social, logout, toast, say, dismissToast, cartOpen, loginOpen, optMail, optIn, subscribed, totals, tkSite]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
