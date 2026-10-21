import { useEffect, useRef, useState } from 'react';
import { api, fmt } from '../api.js';
import { useStore } from '../store.jsx';

export const openChat = () => window.dispatchEvent(new Event('ar:openchat'));

const time = t => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const WELCOME = 'Assalamu alaikum! 👋 Welcome to AR Trade International. How can we help you today?';
const QUICK = ['Find toner for my printer', 'Delivery charges', 'Book printer servicing', 'Track my order'];

export default function Chat() {
  const { site } = useStore();
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
  useEffect(() => { if (open && box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, typing, open]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const reply = t => {
    t = t.toLowerCase();
    if (/toner|cartridge|ink|টোনার|কার্টিজ/.test(t)) return 'We stock original HP, Canon, Toshiba and Sharp toner. Share your printer model (e.g. HP M12w) and we will confirm the exact cartridge and today\'s price.';
    if (/deliver|shipping|ডেলিভারি/.test(t)) return `Inside Dhaka: ${site.insideFee ? fmt(site.insideFee) : 'free'} delivery with cash on delivery. Outside Dhaka: ${fmt(site.outsideFee)} via courier. Order before 2 PM for same-day dispatch.`;
    if (/service|repair|servicing|সার্ভিস/.test(t)) return `Printer servicing starts from ${fmt(site.svcPrices[0].offer)} inside Dhaka, and it is free every Saturday at our Santinagar house (parts extra). You can book from the Servicing page.`;
    if (/order|track|অর্ডার/.test(t)) return 'You can track every order on the Track order page. Share your order ID (e.g. AR-10480) and I will check the status for you.';
    if (/price|cost|দাম|quote/.test(t)) return 'Happy to help with a quote. Tell me the model and quantity — corporate and bulk orders get special pricing.';
    return `Thanks for your message! A team member will reply here shortly. For anything urgent, call ${site.phone}.`;
  };

  const send = t => {
    t = (t || '').trim();
    if (!t) return;
    setMsgs(m => [...m, { from: 'me', text: t, at: Date.now() }]);
    setText(''); setTyping(true);
    api.post('/chat', { text: t }).catch(() => {});
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setMsgs(m => [...m, { from: 'agent', text: reply(t), at: Date.now() }]); setTyping(false); }, 1300);
  };

  const agentN = msgs.filter(m => m.from === 'agent').length;
  const unread = !open ? Math.max(0, agentN - seen) : 0;
  const all = [{ from: 'agent', text: WELCOME, at: msgs[0]?.at || Date.now() }, ...msgs];

  if (!open) {
    return (
      <button className="chat-open" onClick={() => { setOpen(true); setSeen(agentN); }}>
        <span className="avatar"><img src="/ar-icon-round.png" alt="AR Trade" /></span>
        <span className="tx"><b>Chat with us</b><small>Replies in a few minutes</small></span>
        {unread > 0 && <span className="un">{unread}</span>}
      </button>
    );
  }
  return (
    <div className="chat">
      <div className="hd">
        <div className="row">
          <div className="who"><span className="avatar"><img src="/ar-icon-round.png" alt="AR Trade" /></span><div><b>AR Trade Support</b><small>Online · Sat–Thu, 10:00–20:00</small></div></div>
          <button className="min" onClick={() => { setOpen(false); setSeen(agentN); }} title="Minimise">✕</button>
        </div>
        <div className="links">
          <a href={'https://wa.me/' + site.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
          <a href="tel:+8801977554401">Call us</a>
          <a href="/track">Track order</a>
        </div>
      </div>
      <div className="msgs" ref={box}>
        {all.map((m, i) => (
          <div key={i} className={'m ' + (m.from === 'me' ? 'me' : '')}>
            <div className="bub">{m.text}</div>
            <small>{m.from === 'me' ? 'You' : 'AR Support'} · {time(m.at)}</small>
          </div>
        ))}
        {typing && <div className="typing"><i /><i /><i /></div>}
        {msgs.length < 2 && !typing && <div className="quick">{QUICK.map(q => <button key={q} onClick={() => send(q)}>{q}</button>)}</div>}
      </div>
      <form onSubmit={e => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Type your message… (বাংলাতেও লিখতে পারেন)" />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
