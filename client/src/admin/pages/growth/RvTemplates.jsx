import { useRef, useState } from 'react';
import { send } from './pricesApi.js';
import { useT } from '../../i18n/lang.jsx';
import { RvMsg, rvMsg } from './rvApi.jsx';

const CHIPS = ['{name}', '{shop}', '{products}', '{link}', '{optout}'];

/** English | Bangla template editor with placeholder chips, preview and a test e-mail. Edits stay in the parent until Save settings. */
export default function RvTemplates({ templates, onChange }) {
  const tr = useT();
  const [lang, setLang] = useState('en');
  const [prev, setPrev] = useState(null);
  const [to, setTo] = useState('');
  const [m, setM] = useState(null);
  const body = useRef(null), subj = useRef(null), last = useRef('body');
  const t = templates[lang] || { subject: '', body: '' };
  const put = (k, v) => onChange({ ...templates, [lang]: { ...t, [k]: v } });
  const insert = chip => {
    const k = last.current, el = (k === 'body' ? body : subj).current;
    const v = t[k] || '', a = el?.selectionStart ?? v.length, b = el?.selectionEnd ?? v.length;
    put(k, v.slice(0, a) + chip + v.slice(b));
    setTimeout(() => { el?.focus(); el?.setSelectionRange(a + chip.length, a + chip.length); }, 0);
  };
  const preview = async () => { setM(null); const r = await send('/growth/review-settings/preview', { lang }); if (r.ok) setPrev(r.body); else { setPrev(null); setM(rvMsg(r, undefined, tr)); } };
  const test = async () => { setM(null); if (!to.trim()) return setM({ ok: false, text: tr('Type the e-mail address to send the test to.') }); const r = await send('/growth/review-settings/test', { to: to.trim() }); setM(rvMsg(r, tr('Test e-mail sent to {to}.', { to: to.trim() }), tr)); };
  return (
    <div className="adrv-field">
      <b>{tr('Message templates')}</b>
      <div className="adrv-tabs">{[['en', 'EN'], ['bn', 'বাংলা']].map(([k, l]) => <button key={k} type="button" className={'adrv-tab' + (lang === k ? ' adrv-on' : '')} onClick={() => { setLang(k); setPrev(null); }}>{l}</button>)}</div>
      <label className="adrv-field">{tr('Subject')}<input ref={subj} className="a-in" lang={lang} value={t.subject || ''} onFocus={() => { last.current = 'subject'; }} onChange={e => put('subject', e.target.value)} /></label>
      <label className="adrv-field">{tr('Message')}<textarea ref={body} className="a-in adrv-area" lang={lang} value={t.body || ''} onFocus={() => { last.current = 'body'; }} onChange={e => put('body', e.target.value)} /></label>
      <div className="adrv-chips" aria-label={tr('Insert a placeholder')}>{CHIPS.map(c => <button key={c} type="button" className="adrv-chip" title={tr('Insert at the cursor')} onClick={() => insert(c)}>{c}</button>)}</div>
      <small>{tr('{name} customer name, {shop} your shop name, {products} what they bought, {link} the review page, {optout} the unsubscribe link. Press Save settings to keep your changes. Preview shows the last saved text.')}</small>
      <div className="adrv-row">
        <button type="button" className="a-btn ghost sm" onClick={preview}>{tr('Preview')}</button>
        <input className="a-in" type="email" placeholder={tr('your e-mail for a test')} value={to} onChange={e => setTo(e.target.value)} />
        <button type="button" className="a-btn ghost sm" onClick={test}>{tr('Send test e-mail')}</button>
      </div>
      <RvMsg m={m} />
      {prev && <div className="adrv-prev"><b>{prev.subject}</b><pre className="adrv-pre">{prev.body}</pre>{prev.html && <iframe className="adrv-frame" title={tr('E-mail preview')} sandbox="" srcDoc={prev.html} />}</div>}
    </div>
  );
}
