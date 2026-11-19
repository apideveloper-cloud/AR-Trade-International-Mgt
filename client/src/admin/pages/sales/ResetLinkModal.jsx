import { useState } from 'react';
import { Modal } from '../../ui.jsx';
import './salesInline.css';

/** Shows a one-time password reset link with copy and WhatsApp actions. `link` is { name, phone, url, hours }. */
export function ResetLinkModal({ link, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal kicker="Password reset" title={'Reset link for ' + link.name} onClose={onClose}
      footer={<>
        <button type="button" className="a-btn sm" onClick={() => { navigator.clipboard?.writeText(link.url)?.catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? 'Copied ✓' : 'Copy link'}</button>
        <a className="a-btn ghost sm" target="_blank" rel="noreferrer" href={`https://wa.me/88${String(link.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent('AR Trade: set a new password here (valid 24 hours): ' + link.url)}`}>Send on WhatsApp</a>
        <button type="button" className="a-btn ghost sm" onClick={onClose}>Close</button>
      </>}>
      <div className="sinl-col">
        <span className="sinl-note">Send this one-time link to <b>{link.name}</b>{link.phone ? ' (' + link.phone + ')' : ''}. It stays valid for <b>{link.hours} hours</b> and works once. The customer opens it and chooses a new password.</span>
        <input className="a-input sinl-mono" readOnly value={link.url} onFocus={e => e.target.select()} />
      </div>
    </Modal>
  );
}
