import { Link } from 'react-router-dom';
import { useStore } from '../../store.jsx';

const TOAST_ICON = {
  success: <path className="draw" d="M5 12.5l4.5 4.5L19 7.5" />,
  error: <><path d="M12 7v6.5" /><circle cx="12" cy="17.2" r=".6" fill="currentColor" /></>,
  info: <><path d="M12 11v6" /><circle cx="12" cy="7.6" r=".6" fill="currentColor" /></>,
  cart: <><path d="M5 7h14l-1.4 9.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 7z" /><path d="M9 7V6a3 3 0 0 1 6 0v1" /></>
};
const TOAST_TITLE = { success: 'All done', error: 'Please check', info: 'Heads up', cart: 'Added to cart' };

/** Pop-up notice: coloured icon badge, title + message, a countdown bar and a close button. */
export default function Toast() {
  const { toast, dismissToast } = useStore();
  if (!toast) return null;
  const k = toast.kind || 'info';
  const text = k === 'cart' ? toast.text.replace(/^Added:\s*/i, '') : toast.text;
  return (
    <div className={'toast t-' + k} key={toast.id} role={k === 'error' ? 'alert' : 'status'} aria-live="polite" style={{ '--dur': (toast.ms || 3200) + 'ms' }}>
      <i className="ti"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{k === 'error' || k === 'info' ? <circle cx="12" cy="12" r="9.2" strokeWidth="2" /> : null}{TOAST_ICON[k]}</svg></i>
      <div className="tx"><b>{TOAST_TITLE[k]}</b><span>{text}</span></div>
      {toast.link && <Link to={toast.link} onClick={dismissToast}>View cart</Link>}
      <button type="button" className="tc" onClick={dismissToast} aria-label="Dismiss">×</button>
      <u className="tb" />
    </div>
  );
}
