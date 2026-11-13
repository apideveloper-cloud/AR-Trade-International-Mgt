import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adm, dateF } from '../../adminApi.js';
import { Modal, Pill, ROLE_HUE, Summary } from '../../ui.jsx';
import { useApiData } from '../../hooks/useApiData.js';

/** A readable random password that passes the rule (8+ characters with a letter and a number). */
function genPassword() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz', D = '23456789', A = L + D;
  const r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  let p = '';
  for (let i = 0; i < 8; i++) p += A[r(A.length)];
  return p + D[r(D.length)] + L[r(L.length)];
}

/** 0-4: how strong a password is (length, letters, digits, mixed case / symbol). */
function pwScore(p) {
  const v = String(p || '');
  let n = 0;
  if (v.length >= 8) n++;
  if (/[A-Za-z]/.test(v) && /\d/.test(v)) n++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) n++;
  if (v.length >= 12 || /[^A-Za-z0-9]/.test(v)) n++;
  return v.length ? Math.max(1, n) : 0;
}
const PW_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];

const blankMember = roles => ({ name: '', email: '', phone: '', role: (roles.find(r => r.assignable && !r.legacy && r.name !== 'Master Admin' && r.name !== 'Admin') || roles.find(r => r.assignable) || {}).name || '', password: genPassword(), show: true, nid: '', presentAddress: '', contactAddress: '', same: false, refName: '', refPhone: '' });

/** The one-way hand-over of the Master Admin role: the person must type TRANSFER to confirm. */
function TransferModal({ to, onClose }) {
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault();
    if (word.trim().toUpperCase() !== 'TRANSFER' || busy) return;
    setBusy(true); setErr('');
    try { await adm.post('/staff/' + to.id + '/make-master', { confirm: 'TRANSFER' }); window.location.reload(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <Modal narrow kicker="Master Admin" title="Hand over the Master Admin role" onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn danger" disabled={word.trim().toUpperCase() !== 'TRANSFER' || busy}>{busy ? 'Transferring…' : 'Transfer role'}</button></>}>
      <p className="pwm-note" style={{ color: '#3a4558', fontSize: 14 }}>There is only one Master Admin. This makes <b>{to.name}</b> the Master Admin and turns <b>you</b> into an Admin. You can't undo it yourself; only the new Master Admin can hand it back.</p>
      <label className="a-lbl"><span>Type <b>TRANSFER</b> to confirm</span>
        <input className="a-input" value={word} onChange={e => setWord(e.target.value)} placeholder="TRANSFER" autoFocus autoComplete="off" />
      </label>
      {err && <div className="a-msg err">{err}</div>}
    </Modal>
  );
}

export function Team({ me }) {
  const [add, setAdd] = useState(null); // null | { id?, name, email, phone, role, password, show, nid, presentAddress, contactAddress, same, refName, refPhone, busy, err, done }
  const [copied, setCopied] = useState(false);
  const [transferFor, setTransferFor] = useState(null);
  const staffQ = useApiData(() => adm.get('/staff'), [], []);
  const rolesQ = useApiData(() => adm.get('/staff/roles'), [], []);
  const rows = staffQ.data, roles = rolesQ.data, load = staffQ.reload;
  const [err, setErr] = useState('');
  const act = async (id, body) => { try { await adm.put('/staff/' + id, body); setErr(''); load(); } catch (e) { setErr(e.message); } };
  const hue = r => ROLE_HUE[r] ?? 250;
  const pending = rows.filter(r => r.status === 'Pending').length;
  return (
    <>
      {transferFor && <TransferModal to={transferFor} onClose={() => setTransferFor(null)} />}
      <Summary items={[
        ['Team members', rows.length, rows.filter(r => r.status === 'Active').length + ' active', 'blue', 'users'],
        ['Waiting for approval', pending, pending ? 'Open the list below to approve' : 'Nobody is waiting', 'amber', 'clock'],
        ['Roles in use', new Set(rows.map(r => r.role)).size, roles.filter(r => !r.legacy).length + ' main roles available', 'violet', 'tag'],
        ['Disabled', rows.filter(r => r.status === 'Disabled').length, 'Cannot sign in', 'red', 'alert']
      ]} />
      <div className="a-card" style={{ padding: 0, gap: 0 }}>
        <div className="mk-hd" style={{ padding: '12px 16px' }}><b>User roles</b><span style={{ flex: 1 }} />{me.perms?.includes('roles.manage') ? <Link to="/admin/roles" className="a-btn sm grad">Open the role matrix →</Link> : <span className="muted">What each role can do is set by the Master Admin</span>}</div>
        <div className="rl2-grid">
          {roles.filter(r => !r.legacy).map(r => {
            const mem = rows.filter(x => x.role === r.name);
            const total = Math.max(...roles.map(x => x.perms), 1);
            const body = (
              <>
                <div className="rl2-top"><span className="rl2-ic">{r.icon}</span><em title={mem.length + ' member(s)'}>{mem.length}</em></div>
                <b>{r.name}</b>
                <span className="rl2-desc">{r.desc}</span>
                <div className="rl2-ring" style={{ '--p': Math.round(r.perms / total * 100) }} title={r.perms + ' of ' + total + ' permissions'}><i>{r.perms}<small>/ {total}</small></i></div>
                <div className="rl2-av">
                  {mem.slice(0, 3).map(m => <span key={m.id} title={m.name}>{m.name[0]}</span>)}
                  {mem.length > 3 && <span className="more">+{mem.length - 3}</span>}
                  {!mem.length && <small>No members yet</small>}
                </div>
              </>
            );
            return me.perms?.includes('roles.manage')
              ? <Link key={r.name} to="/admin/roles" className="rl2" style={{ '--h': hue(r.name) }} title="Open the role matrix">{body}</Link>
              : <div key={r.name} className="rl2" style={{ '--h': hue(r.name) }}>{body}</div>;
          })}
        </div>
      </div>
      {(err || staffQ.error || rolesQ.error) && <div className="a-msg err">{err || staffQ.error || rolesQ.error}</div>}
      <div className="a-card" style={{ padding: 0, gap: 0 }}>
        <div className="mk-hd" style={{ padding: '12px 16px' }}><b>Team accounts</b><span className="chip">{rows.length}</span><span style={{ flex: 1 }} /><button type="button" className="a-btn sm grad" onClick={() => setAdd(blankMember(roles))}>＋ Add team member</button></div>
        {rows.map(a => (
          <div key={a.id} className="tm-row">
            <span className="tm-av" style={{ '--h': hue(a.role) }}>{a.name[0]}</span>
            <div className="tm-who"><b>{a.name}{a.id === me.id && <em>you</em>}</b><span>{a.email} · since {dateF(a.since)}</span></div>
            {a.id === me.id && <span className="tm-role" style={{ '--h': hue(a.role) }}>{a.role}</span>}
            {a.id !== me.id && <select className="a-input" value={a.role} onChange={e => act(a.id, { role: e.target.value })} style={{ width: 'auto', padding: '5px 8px', fontSize: 12, fontWeight: 700 }}>{roles.filter(r => r.assignable || r.name === a.role).map(r => <option key={r.name} disabled={!r.assignable}>{r.name}</option>)}</select>}
            <Pill s={a.status === 'Pending' ? 'New' : a.status} label={a.status} />
            <button type="button" className="a-btn sm ghost" onClick={() => setAdd({ id: a.id, name: a.name, email: a.email, phone: a.phone, role: a.role, nid: a.nid, presentAddress: a.presentAddress, contactAddress: a.contactAddress, same: !!a.presentAddress && a.presentAddress === a.contactAddress, refName: a.refName, refPhone: a.refPhone })}>Details</button>
            {a.id !== me.id && a.status !== 'Active' && <button className="a-btn sm" onClick={() => act(a.id, { status: 'Active' })}>Approve</button>}
            {me.role === 'Master Admin' && a.id !== me.id && a.status === 'Active' && <button type="button" className="a-btn sm ghost" title="Make this person the Master Admin; you become an Admin" onClick={() => setTransferFor(a)}>★ Make Master</button>}
            {a.id !== me.id && a.status === 'Active' && <button className="a-btn sm ghost" onClick={() => act(a.id, { status: 'Disabled' })}>Disable</button>}
          </div>
        ))}
      </div>
      {add && (
        <Modal side kicker="Team" title={add.done ? 'Account created' : add.id ? 'Team member details' : 'Add a team member'} onClose={() => { setAdd(null); setCopied(false); }}
          onSubmit={async e => {
            e.preventDefault();
            if (add.busy) return; // already saving: ignore a second Enter / click
            setAdd(x => ({ ...x, busy: true, err: '' }));
            const body = { name: add.name, email: add.email, phone: add.phone, nid: add.nid, presentAddress: add.presentAddress, contactAddress: add.same ? add.presentAddress : add.contactAddress, refName: add.refName, refPhone: add.refPhone };
            try {
              if (add.id) { await adm.put('/staff/' + add.id + '/details', body); setAdd(null); }
              else { await adm.post('/staff', { ...body, role: add.role, password: add.password }); setAdd(x => ({ ...x, busy: false, done: true })); }
              load();
            } catch (x) { setAdd(v => ({ ...v, busy: false, err: x.message })); }
          }}
          footer={add.done
            ? <button type="button" className="a-btn" onClick={() => { setAdd(null); setCopied(false); }}>Done</button>
            : <><button type="button" className="a-btn ghost" onClick={() => setAdd(null)}>Cancel</button><button className="a-btn grad" disabled={add.busy}>{add.busy ? 'Saving…' : add.id ? 'Save details' : 'Create account'}</button></>}>
          {add.done ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="a-msg ok" style={{ fontSize: 14 }}>✓ <b>{add.name}</b> can sign in now as <b>{add.role}</b>.</div>
              <div className="tm-cred">
                <div><small>Sign in at</small><b>{window.location.origin}/admin</b></div>
                <div><small>Email or mobile</small><b>{add.email} · {add.phone}</b></div>
                <div><small>Password</small><b className="mono">{add.password}</b></div>
              </div>
              <button type="button" className="a-btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => { try { navigator.clipboard.writeText(`AR Trade admin console\n${window.location.origin}/admin\nLogin: ${add.email} or ${add.phone}\nPassword: ${add.password}`); } catch { /* clipboard unavailable */ } setCopied(true); }}>{copied ? 'Copied ✓' : '⧉ Copy login details'}</button>
              <span style={{ fontSize: 12.5, color: '#6b7388', lineHeight: 1.5 }}>Give these details to {add.name} privately. The password is not shown again, and they can change it from their own account.</span>
            </div>
          ) : (
            <div className="tm-form">
              <h4 className="cx-h">Account</h4>
              <label className="a-lbl">Full name<input className="a-input" required value={add.name} onChange={e => setAdd(x => ({ ...x, name: e.target.value }))} placeholder="e.g. Nusrat Jahan" /></label>
              <label className="a-lbl">NID number<input className="a-input" inputMode="numeric" maxLength={17} value={add.nid} onChange={e => setAdd(x => ({ ...x, nid: e.target.value.replace(/D/g, '') }))} placeholder="10, 13 or 17 digits" /></label>
              <label className="a-lbl">Work email<input className="a-input" type="email" required value={add.email} onChange={e => setAdd(x => ({ ...x, email: e.target.value }))} placeholder="name@company.com" /></label>
              <label className="a-lbl">Mobile number<input className="a-input" type="tel" required maxLength={11} value={add.phone} onChange={e => setAdd(x => ({ ...x, phone: e.target.value.replace(/D/g, '') }))} placeholder="01XXXXXXXXX" /></label>
              {!add.id && (
                <>
                  <label className="a-lbl">Role<select className="a-input" required value={add.role} onChange={e => setAdd(x => ({ ...x, role: e.target.value }))}>{roles.filter(r => r.assignable).map(r => <option key={r.name} value={r.name}>{r.name}{r.legacy ? ' (existing role)' : ''}</option>)}</select>
                    <small className="tm-hint">There is only one Master Admin. Use "Make Master" on the list to hand it over.</small>
                  </label>
                  <div className="a-lbl">Password
                    <div className="pw">
                      <i>🔑</i>
                      <input type={add.show ? 'text' : 'password'} required minLength={8} value={add.password} onChange={e => setAdd(x => ({ ...x, password: e.target.value }))} autoComplete="new-password" aria-label="Password" />
                      <button type="button" className="pw-eye" onClick={() => setAdd(x => ({ ...x, show: !x.show }))} aria-label={add.show ? 'Hide the password' : 'Show the password'}>{add.show ? '🙈' : '👁'}</button>
                      <button type="button" className="pw-gen" onClick={() => setAdd(x => ({ ...x, password: genPassword(), show: true }))}>⟳ Generate</button>
                    </div>
                    <div className="pw-meter" data-s={pwScore(add.password)}><i /><i /><i /><i /><b>{PW_LABEL[pwScore(add.password)]}</b></div>
                  </div>
                </>
              )}
              <h4 className="cx-h">Addresses</h4>
              <label className="a-lbl">Present address<textarea className="a-input" rows={3} value={add.presentAddress} onChange={e => setAdd(x => ({ ...x, presentAddress: e.target.value }))} placeholder="House, road, area, city" /></label>
              <label className="a-lbl">Contact address
                <textarea className="a-input" rows={3} disabled={add.same} value={add.same ? add.presentAddress : add.contactAddress} onChange={e => setAdd(x => ({ ...x, contactAddress: e.target.value }))} placeholder="Permanent or village address, where we can write to the person" />
                <span className="tm-same"><input type="checkbox" checked={add.same} onChange={e => setAdd(x => ({ ...x, same: e.target.checked }))} />Same as the present address</span>
              </label>
              <h4 className="cx-h">Reference contact</h4>
              <label className="a-lbl">Reference contact person<input className="a-input" value={add.refName} onChange={e => setAdd(x => ({ ...x, refName: e.target.value }))} placeholder="Name of someone who can vouch for this person" /></label>
              <label className="a-lbl">Reference person's cell<input className="a-input" type="tel" maxLength={11} value={add.refPhone} onChange={e => setAdd(x => ({ ...x, refPhone: e.target.value.replace(/D/g, '') }))} placeholder="01XXXXXXXXX" /></label>
              {add.err && <div className="a-msg err full">{add.err}</div>}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
