import { useEffect, useRef, useState } from 'react';
import { productPath } from '../slug.js';
import { Link } from 'react-router-dom';
import { api, fmt } from '../api.js';
import { deliveryOf } from '../data.js';
import { useStore } from '../store.jsx';
import ChatStart from './ChatStart.jsx';
import { assistantStatus } from '../supportHours.js';
import './chat-avatar.css';

// the support agent's photo (client/public/agent.webp); the round AR logo is the fallback
const AGENT_PIC = '/agent.webp', LOGO_PIC = '/ar-icon-round.png';
const AgentPic = ({ className = '' }) => <img className={className} src={AGENT_PIC} alt="Support Team" decoding="async" onError={e => { if (!e.currentTarget.src.endsWith(LOGO_PIC)) e.currentTarget.src = LOGO_PIC; }} />;

export const openChat = () => window.dispatchEvent(new Event('ar:openchat'));

const time = t => new Date(t).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: '2-digit', hour12: true });
const welcome = name => `Assalamu alaikum${name ? ', ' + name.split(' ')[0] : ''}! 👋 Welcome to AR Trade International. How can we help you today?`;
const LEAD_KEY = 'ar_chat_lead';
const readLead = () => { try { const l = JSON.parse(localStorage.getItem(LEAD_KEY)); return l?.token ? l : null; } catch { return null; } };
const QUICK = ['Find toner for my printer', 'Delivery charges', 'Book printer servicing', 'Track my order'];

// words that say what the visitor wants, not which product: they are ignored when matching product names
const STOP = new Set(('a an the of for to is are me my you your i we us please pls give tell show what whats how much price prices cost rate quote need want have has any available stock in with and or about buy get can could would do does this that it on at from there find looking look hi hello hey thanks thank ok okay'
  + ' দাম কত আছে লাগবে চাই').split(' '));
const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Looks the visitor's words up in the catalogue: a model number (MX-235AT, CF279A, 12A) must match, or two or more plain words that narrow it to a few products. */
export function findProducts(text, products) {
  const words = (String(text).toLowerCase().match(/[a-z0-9][a-z0-9\-/.]*/g) || []).map(squash).filter(Boolean);
  const models = words.filter(w => w.length >= 3 && /\d/.test(w) && /[a-z]/.test(w));
  const plain = words.filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w) && !models.includes(w));
  if (!models.length && plain.length < 2) return [];
  const hits = [];
  for (const p of products) {
    const label = p.name + ' ' + (p.part || '') + ' ' + (p.sku || '') + ' ' + (p.brand || '');
    const hay = squash(label), hayWords = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    // short model codes (12A, T372) must be a whole word, or they would match inside other numbers (W2412A); longer ones may span a hyphen (MX-235AT)
    const hasModel = m => hayWords.includes(m) || (m.length >= 6 && hay.includes(m));
    if (models.length ? !models.every(hasModel) : !plain.every(w => hay.includes(w))) continue;
    hits.push({ p, score: plain.filter(w => hay.includes(w)).length * 2 + (p.stock > 0 ? 1 : 0) + (p.price > 0 ? 1 : 0) });
  }
  if (!models.length && hits.length > 6) return []; // too general to be a particular product
  return hits.sort((a, b) => b.score - a.score).slice(0, 3).map(h => h.p);
}

export default function Chat() {
  const { site, products, user } = useStore();
  const [lead, setLead] = useState(readLead);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [seen, setSeen] = useState(0);
  const box = useRef(null);
  const timer = useRef();

  useEffect(() => {
    const on = () => { setOpen(true); setSeen(msgs.filter(m => m.from === 'agent').length); };
    window.addEventListener('ar:openchat', on);
    return () => window.removeEventListener('ar:openchat', on);
  }, [msgs]);
  // keep the launcher above the footer's "Dev By" bar instead of covering it
  useEffect(() => {
    const place = () => {
      const bar = document.querySelector('.foot-bot');
      const top = bar ? bar.getBoundingClientRect().top : Infinity;
      document.documentElement.style.setProperty('--chat-lift', top < window.innerHeight ? Math.round(window.innerHeight - top + 14) + 'px' : '22px');
    };
    place();
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place); window.removeEventListener('resize', place); };
  }, []);
  useEffect(() => { if (open && box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, typing, open]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const canned = t => {
    t = t.toLowerCase();
    if (/toner|cartridge|ink|টোনার|কার্টিজ/.test(t)) return 'We stock original HP, Canon, Toshiba and Sharp toner. Share your printer model (e.g. HP M12w) and we will confirm the exact cartridge and today\'s price.';
    if (/deliver|shipping|ডেলিভারি/.test(t)) { const dv = deliveryOf(site); return `Inside Dhaka: free within ${dv.freeKm} km of our Santinagar office, then ${fmt(dv.tiers[0].fee)} up to ${fmt(dv.maxFee)} depending on distance (cash on delivery). Outside Dhaka by courier: ${fmt(site.outsideFee)}. Order before 2 PM for same-day dispatch.`; }
    if (/service|repair|servicing|সার্ভিস/.test(t)) return `Printer servicing starts from ${fmt(site.svcPrices[0].offer)} inside Dhaka, and it is free every Saturday at our Santinagar house (parts extra). You can book from the Servicing page.`;
    if (/order|track|অর্ডার/.test(t)) return 'You can track every order on the Track order page. Share your order ID (e.g. AR-10480) and I will check the status for you.';
    if (/price|cost|দাম|quote/.test(t)) return 'Happy to help with a quote. Tell me the model and quantity — corporate and bulk orders get special pricing.';
    return `Thanks for your message! A team member will reply here shortly. For anything urgent, call ${site.phone}.`;
  };

  const reply = t => {
    const lower = t.toLowerCase();
    if (/^\s*(hi|hii|hello|hey|salam|assalamu|হাই|হ্যালো|সালাম|আসসালামু)/.test(lower) && lower.length < 24) return { text: 'Hello! 👋 Ask me about any product: type its model (for example MX-235AT or CF279A) and I will show the price and stock. For anything else, our team will reply here.' };
    if (/^\s*(thanks|thank you|thx|ধন্যবাদ)/.test(lower)) return { text: 'You are welcome! Anything else I can help with?' };
    const items = findProducts(t, products);
    if (items.length) {
      const stockTxt = p => (p.stock > 0 ? 'in stock' : 'out of stock right now (call us and we will arrange it)');
      const top = items[0];
      const text = items.length === 1
        ? (top.price > 0 ? `${top.name}: ${fmt(top.price)}, ${stockTxt(top)}. Tap the card to open it or add it to your cart.`
          : `${top.name} is ${stockTxt(top)}. Its price is on request, so please call ${site.phone} or WhatsApp us and we will quote it today.`)
        : `I found ${items.length} matching products.${items.some(p => !(p.price > 0)) ? ` Where the price says "on request", call ${site.phone} or WhatsApp us for today's quote.` : ''}`;
      return { text, items: items.map(p => ({ id: p.id, name: p.name, img: p.img, price: p.price, stock: p.stock })) };
    }
    return { text: canned(t) };
  };

  // the assistant is always online; the clock shows Dhaka time and is refreshed every minute
  const [sup, setSup] = useState(() => assistantStatus());
  useEffect(() => { const t = setInterval(() => setSup(assistantStatus()), 60000); return () => clearInterval(t); }, []);

  const ctxRef = useRef({});
  const send = t => {
    t = (t || '').trim();
    if (!t) return;
    const history = msgs.slice(-8).map(m => ({ from: m.from, text: m.text }));
    setMsgs(m => [...m, { from: 'me', text: t, at: Date.now() }]);
    setText(''); setTyping(true);
    clearTimeout(timer.current);
    const started = Date.now();
    const show = r => {
      // never answer faster than a person would type; the shop's own answer comes from the server, the built-in one is the fallback
      timer.current = setTimeout(() => { setMsgs(m => [...m, { from: 'agent', text: r.text, items: r.items, at: Date.now() }]); setTyping(false); }, Math.max(0, 900 - (Date.now() - started)));
    };
    api.post('/chat', { text: t, ctx: ctxRef.current, history, lead: lead?.token })
      .then(res => { if (res?.reply?.text) { ctxRef.current = res.reply.ctx || {}; show(res.reply); } else show(reply(t)); })
      .catch(() => show(reply(t)));
  };

  const agentN = msgs.filter(m => m.from === 'agent').length;
  const unread = !open ? Math.max(0, agentN - seen) : 0;
  const all = [{ from: 'agent', text: welcome(lead?.name), at: msgs[0]?.at || Date.now() }, ...msgs];

  if (!open) {
    return (
      <button className="chat-open" onClick={() => { setOpen(true); setSeen(agentN); }}>
        <span className={'avatar' + (sup.online ? '' : ' off')}><AgentPic /></span>
        <span className="tx"><b>Chat with us</b><small>Replies in a few minutes</small></span>
        {unread > 0 && <span className="un">{unread}</span>}
      </button>
    );
  }
  return (
    <div className="chat">
      <div className="hd">
        <div className="row">
          <div className="who"><span className={'avatar' + (sup.online ? '' : ' off')}><AgentPic /></span><div><b>Support Team</b><small>{sup.label}</small></div></div>
          <button className="min" onClick={() => { setOpen(false); setSeen(agentN); }} title="Minimise">✕</button>
        </div>
        <div className="links">
          <a href={'https://wa.me/' + site.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
          <a href="tel:+8801977554401">Call us</a>
          <Link to="/track" onClick={() => { setOpen(false); setSeen(agentN); }}>Track order</Link>
        </div>
      </div>
      {!lead ? (
        <ChatStart user={user} onDone={l => { try { localStorage.setItem(LEAD_KEY, JSON.stringify(l)); } catch { /* storage unavailable: the chat still works for this visit */ } setLead(l); }} />
      ) : (
        <>
      <div className="msgs" ref={box}>
        {all.map((m, i) => (
          <div key={i} className={'m ' + (m.from === 'me' ? 'me' : '')}>
            <div className="brow">
              {m.from !== 'me' && <AgentPic className="agent-pic" />}
              <div className="bub">{m.text}</div>
            </div>
            {m.items?.length > 0 && (
              <div className="cpcs">
                {m.items.map(p => (
                  <Link key={p.id} to={productPath(p)} className="cpc" onClick={() => { setOpen(false); setSeen(agentN); }}>
                    <span className="im" style={{ backgroundImage: p.img ? `url('${p.img}')` : 'none' }} />
                    <span className="tx"><b>{p.name}</b><em className={p.price > 0 ? '' : 'rq'}>{p.price > 0 ? fmt(p.price) : 'Price on request'}</em><small>{p.stock > 0 ? 'In stock' : 'Out of stock'}</small></span>
                  </Link>
                ))}
              </div>
            )}
            <small>{m.from === 'me' ? 'You' : 'Support Team'} · {time(m.at)}</small>
          </div>
        ))}
        {typing && <div className="brow"><AgentPic className="agent-pic" /><div className="typing"><i /><i /><i /></div></div>}
        {msgs.length < 2 && !typing && <div className="quick">{QUICK.map(q => <button key={q} onClick={() => send(q)}>{q}</button>)}</div>}
      </div>
      <form onSubmit={e => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Type your message… (বাংলাতেও লিখতে পারেন)" />
        <button type="submit">Send</button>
      </form>
        </>
      )}
    </div>
  );
}
