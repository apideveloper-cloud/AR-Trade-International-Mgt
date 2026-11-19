import { useState } from 'react';
import { adm } from '../../../adminApi.js';
import { Modal } from '../../../ui.jsx';
import { PW_LABEL, genPassword, pwScore } from './passwords.js';
import './team.css';

/** A fresh "add member" form state, defaulting to the first ordinary assignable role. */
export const blankMember = roles => ({ name: '', email: '', phone: '', role: (roles.find(r => r.assignable && !r.legacy && r.name !== 'Master Admin' && r.name !== 'Admin') || roles.find(r => r.assignable) || {}).name || '', password: genPassword(), show: true, nid: '', presentAddress: '', contactAddress: '', same: false, refName: '', refPhone: '' });

/** Form state of an existing member opened for editing. */
export const memberToForm = a => ({ id: a.id, name: a.name, email: a.email, phone: a.phone, role: a.role, nid: a.nid, presentAddress: a.presentAddress, contactAddress: a.contactAddress, same: !!a.presentAddress && a.presentAddress === a.contactAddress, refName: a.refName, refPhone: a.refPhone });

/** Side panel to add a team member (then shows the new login to hand over) or edit one's details. `add` is the form state. */
export function MemberModal({ add, setAdd, roles, onSaved }) {
  const [copied, setCopied] = useState(false);
  const close = () => setAdd(null);
  const field = k => e => setAdd(x => ({ ...x, [k]: e.target.value }));
  const digits = k => e => setAdd(x => ({ ...x, [k]: e.target.value.replace(/\D/g, '') }));
  const submit = async e => {
    e.preventDefault();
    if (add.busy) return; // already saving: ignore a second Enter / click
    setAdd(x => ({ ...x, busy: true, err: '' }));
    const body = { name: add.name, email: add.email, phone: add.phone, nid: add.nid, presentAddress: add.presentAddress, contactAddress: add.same ? add.presentAddress : add.contactAddress, refName: add.refName, refPhone: add.refPhone };
    try {
      if (add.id) { await adm.put('/staff/' + add.id + '/details', body); setAdd(null); }
      else { await adm.post('/staff', { ...body, role: add.role, password: add.password }); setAdd(x => ({ ...x, busy: false, done: true })); }
      onSaved();
    } catch (x) { setAdd(v => ({ ...v, busy: false, err: x.message })); }
  };
  const copy = () => {
    try { navigator.clipboard.writeText(`AR Trade admin console\n${window.location.origin}/admin\nLogin: ${add.email} or ${add.phone}\nPassword: ${add.password}`); } catch { /* clipboard unavailable */ }
    setCopied(true);
  };
  return (
    <Modal side kicker="Team" title={add.done ? 'Account created' : add.id ? 'Team member details' : 'Add a team member'} onClose={close} onSubmit={submit}
      footer={add.done
        ? <button type="button" className="a-btn" onClick={close}>Done</button>
        : <><button type="button" className="a-btn ghost" onClick={close}>Cancel</button><button className="a-btn grad" disabled={add.busy}>{add.busy ? 'Saving…' : add.id ? 'Save details' : 'Create account'}</button></>}>
      {add.done ? (
        <div className="xteam-done">
          <div className="a-msg ok xteam-ok">✓ <b>{add.name}</b> can sign in now as <b>{add.role}</b>.</div>
          <div className="tm-cred">
            <div><small>Sign in at</small><b>{window.location.origin}/admin</b></div>
            <div><small>Email or mobile</small><b>{add.email} · {add.phone}</b></div>
            <div><small>Password</small><b className="mono">{add.password}</b></div>
          </div>
          <button type="button" className="a-btn sm xteam-copy" onClick={copy}>{copied ? 'Copied ✓' : '⧉ Copy login details'}</button>
          <span className="xteam-give">Give these details to {add.name} privately. The password is not shown again, and they can change it from their own account.</span>
        </div>
      ) : (
        <div className="tm-form">
          <h4 className="cx-h">Account</h4>
          <label className="a-lbl">Full name<input className="a-input" required value={add.name} onChange={field('name')} placeholder="e.g. Nusrat Jahan" /></label>
          <label className="a-lbl">NID number<input className="a-input" inputMode="numeric" maxLength={17} value={add.nid} onChange={digits('nid')} placeholder="10, 13 or 17 digits" /></label>
          <label className="a-lbl">Work email<input className="a-input" type="email" required value={add.email} onChange={field('email')} placeholder="name@company.com" /></label>
          <label className="a-lbl">Mobile number<input className="a-input" type="tel" required maxLength={11} value={add.phone} onChange={digits('phone')} placeholder="01XXXXXXXXX" /></label>
          {!add.id && (
            <>
              <label className="a-lbl">Role<select className="a-input" required value={add.role} onChange={field('role')}>{roles.filter(r => r.assignable).map(r => <option key={r.name} value={r.name}>{r.name}{r.legacy ? ' (existing role)' : ''}</option>)}</select>
                <small className="tm-hint">There is only one Master Admin. Use "Make Master" on the list to hand it over.</small>
              </label>
              <div className="a-lbl">Password
                <div className="pw">
                  <i>🔑</i>
                  <input type={add.show ? 'text' : 'password'} required minLength={8} value={add.password} onChange={field('password')} autoComplete="new-password" aria-label="Password" />
                  <button type="button" className="pw-eye" onClick={() => setAdd(x => ({ ...x, show: !x.show }))} aria-label={add.show ? 'Hide the password' : 'Show the password'}>{add.show ? '🙈' : '👁'}</button>
                  <button type="button" className="pw-gen" onClick={() => setAdd(x => ({ ...x, password: genPassword(), show: true }))}>⟳ Generate</button>
                </div>
                <div className="pw-meter" data-s={pwScore(add.password)}><i /><i /><i /><i /><b>{PW_LABEL[pwScore(add.password)]}</b></div>
              </div>
            </>
          )}
          <h4 className="cx-h">Addresses</h4>
          <label className="a-lbl">Present address<textarea className="a-input" rows={3} value={add.presentAddress} onChange={field('presentAddress')} placeholder="House, road, area, city" /></label>
          <label className="a-lbl">Contact address
            <textarea className="a-input" rows={3} disabled={add.same} value={add.same ? add.presentAddress : add.contactAddress} onChange={field('contactAddress')} placeholder="Permanent or village address, where we can write to the person" />
            <span className="tm-same"><input type="checkbox" checked={add.same} onChange={e => setAdd(x => ({ ...x, same: e.target.checked }))} />Same as the present address</span>
          </label>
          <h4 className="cx-h">Reference contact</h4>
          <label className="a-lbl">Reference contact person<input className="a-input" value={add.refName} onChange={field('refName')} placeholder="Name of someone who can vouch for this person" /></label>
          <label className="a-lbl">Reference person's cell<input className="a-input" type="tel" maxLength={11} value={add.refPhone} onChange={digits('refPhone')} placeholder="01XXXXXXXXX" /></label>
          {add.err && <div className="a-msg err full">{add.err}</div>}
        </div>
      )}
    </Modal>
  );
}
