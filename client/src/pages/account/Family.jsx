import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store.jsx';
import { H2, acc } from './shared.jsx';

export default function Family() {
  const [rows, setRows] = useState(null);
  const [addrs, setAddrs] = useState([]);
  const { user, say } = useStore();
  const nav = useNavigate();
  const load = () => acc.get('/family').then(setRows).catch(() => setRows(r => r || []));
  useEffect(() => { load(); acc.get('/addresses').then(setAddrs).catch(() => {}); }, []);
  const add = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    try { await acc.post('/family', { name: d.name, relation: d.rel, phone: d.phone, address: d.addr }); e.target.reset(); load(); } catch (er) { say(er.message); }
  };
  const options = [...addrs.map(a => `${a.label} — ${a.line}, ${a.area}`), user?.address].filter(Boolean);
  const COLORS = ['oklch(0.55 0.15 250)', 'oklch(0.6 0.15 150)', 'oklch(0.62 0.18 350)', 'oklch(0.65 0.15 60)'];
  return (
    <>
      <H2 right={<span className="ac-s6">Order for parents, children or colleagues from one account.</span>}>Family &amp; team</H2>
      <div className="ac-s110">
        {rows?.map((f, i) => (
          <div key={f.id} className="ac-card ac-s111">
            <div className="ac-s112"><span style={{ width: 44, height: 44, borderRadius: '50%', background: COLORS[i % 4], color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 17 }}>{f.name[0]}</span><div className="ac-s113"><b className="ac-s91">{f.name}</b><span className="ac-s94">{f.relation} · {f.phone}</span></div></div>
            <span className="ac-s94">Delivers to: <b className="ac-s114">{f.address}</b></span>
            <div className="ac-s115">
              <button className="ac-btn dark sm" onClick={() => { try { sessionStorage.setItem('ar_order_for', JSON.stringify(f)); } catch { /* storage unavailable */ } nav('/shop/all'); }}>Order for {f.name.split(' ')[0]}</button>
              <button className="ac-btn ghost sm ac-s52" onClick={async () => { try { await acc.del('/family/' + f.id); } catch (er) { say(er.message); } load(); }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {rows && !rows.length && <div className="ac-card ac-s97">No sub-profiles yet. Add a family member or colleague below.</div>}
      <form className="ac-card ac-s116" onSubmit={add} >
        <b className="ac-s91">Add a sub-profile</b>
        <div className="ac-s117">
          <label className="ac-lbl">Name<input className="ac-input" name="name" required placeholder="Full name" /></label>
          <label className="ac-lbl">Relation<select className="ac-input" name="rel">{['Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Sibling', 'Colleague', 'Branch office'].map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="ac-lbl">Mobile<input className="ac-input" name="phone" pattern="01[0-9]{9}" placeholder="01XXXXXXXXX" /></label>
          <label className="ac-lbl">Delivery address<select className="ac-input" name="addr">{options.length ? options.map(o => <option key={o}>{o}</option>) : <option>Same as mine</option>}</select></label>
        </div>
        <div><button className="ac-btn dark">Add sub-profile</button></div>
      </form>
    </>
  );
}
