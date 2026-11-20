import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { Avatar } from './Avatar.jsx';
import { Modal } from '../../ui.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/sales.js';
import './setPassword.css';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
/** A random 10-character password without look-alike characters (no 0/O, 1/l/I). */
const newPassword = () => {
  const a = new Uint32Array(10); crypto.getRandomValues(a);
  return [...a.slice(0, 8)].map(n => CHARS[n % CHARS.length]).join('') + [...a.slice(8)].map(n => '23456789'[n % 8]).join('');
};
/** 0 to 4: length, a longer length, upper and lower case together, a number or symbol. */
const strength = p => {
  if (!p) return 0;
  const pts = (p.length >= 8) + (p.length >= 12) + (/[a-z]/.test(p) && /[A-Z]/.test(p)) + (/\d/.test(p) && /[A-Za-z]/.test(p)) + /[^A-Za-z0-9]/.test(p);
  return Math.max(1, Math.min(4, pts));
};
const LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const svg = d => <svg viewBox="0 0 24 24">{d}</svg>;
const I = {
  lock: svg(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  eye: svg(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>),
  eyeOff: svg(<><path d="M3 3l18 18M10.6 6a9.6 9.6 0 0 1 1.4-.1c6 0 9.5 6.1 9.5 6.1a16 16 0 0 1-3 3.6M6.3 7.6A16 16 0 0 0 2.5 12S6 18.1 12 18.1c1.5 0 2.8-.4 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>),
  copy: svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>),
  dice: svg(<><rect x="4" y="4" width="16" height="16" rx="3.5" /><circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" /></>),
  check: svg(<path d="m5 12.5 4.2 4.2L19 7" />)
};

/** Set a customer's password: live rule check and strength, a generator, show/hide and copy as icon buttons. */
export function SetPasswordModal({ c, onClose, onDone }) {
  const tr = useT();
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const rules = [[tr('8+ characters'), pw.length >= 8], [tr('A letter'), /[A-Za-z]/.test(pw)], [tr('A number'), /\d/.test(pw)]];
  const valid = rules.every(r => r[1]);
  const s = strength(pw);
  const copy = async () => { try { await navigator.clipboard.writeText(pw); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr(tr('Could not copy. Select the password and copy it by hand.')); } };
  const submit = async e => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setErr('');
    try { await adm.put(`/customers/${c.userId}/password`, { password: pw }); setSaved(true); onDone(); } catch (er) { setErr(tr(er.message)); }
    setBusy(false);
  };
  return (
    <Modal narrow cls="spw" kicker={tr('Customer account')} title={saved ? tr('Password updated') : tr('Set a new password')} onClose={onClose} onSubmit={submit}
      footer={saved
        ? <button type="button" className="a-btn grad" onClick={onClose}>{tr('Done')}</button>
        : <><button type="button" className="a-btn ghost" onClick={onClose}>{tr('Cancel')}</button><button className="a-btn grad" disabled={!valid || busy}>{busy ? tr('Saving…') : tr('Set password')}</button></>}>
      <div className="spw-who">
        <Avatar name={c.name} cls="spw-av" />
        <div><b>{c.name}</b><small>{c.phone}{c.email ? ' · ' + c.email : ''}</small></div>
      </div>
      {saved ? (
        <div className="spw-done"><span>{I.check}</span><b>{tr('Password saved')}</b><small>{tr('Tell the customer this password now. It is not shown again, and they can change it from their account.')}</small></div>
      ) : (
        <p className="spw-note">{tr('Share it with the customer. They can change it from their account.')}</p>
      )}
      <div className="spw-field">
        <span className="spw-lock">{I.lock}</span>
        <input type={show ? 'text' : 'password'} value={pw} onChange={e => { setPw(e.target.value); setCopied(false); }} placeholder={tr('New password')} autoFocus readOnly={saved} autoComplete="new-password" aria-label={tr('New password')} spellCheck={false} />
        <div className="spw-tools">
          <button type="button" onClick={() => setShow(v => !v)} title={show ? tr('Hide the password') : tr('Show the password')} aria-label={show ? tr('Hide the password') : tr('Show the password')}>{show ? I.eyeOff : I.eye}</button>
          <button type="button" onClick={copy} disabled={!pw} title={tr('Copy the password')} aria-label={tr('Copy the password')} className={copied ? 'ok' : ''}>{copied ? I.check : I.copy}</button>
          {!saved && <button type="button" className="gen" onClick={() => { setPw(newPassword()); setShow(true); setCopied(false); }} title={tr('Generate a strong password')} aria-label={tr('Generate a strong password')}>{I.dice}</button>}
        </div>
      </div>
      {!saved && (
        <div className="spw-row">
          <div className="spw-rules">{rules.map(([t, ok]) => <span key={t} className={ok ? 'ok' : ''}>{ok ? I.check : <i />}{t}</span>)}</div>
          <div className="spw-meter" data-s={s} aria-label={tr('Password strength: {label}', { label: LABEL[s] ? tr(LABEL[s]) : tr('none') })} title={tr('{n} characters', { n: pw.length })}><i /><i /><i /><i /><b>{LABEL[s] ? tr(LABEL[s]) : '—'}</b></div>
        </div>
      )}
      {err && <div className="a-msg err">{err}</div>}
    </Modal>
  );
}
