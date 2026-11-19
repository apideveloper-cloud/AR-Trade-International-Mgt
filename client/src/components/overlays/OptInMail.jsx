import { useStore } from '../../store.jsx';
import './overlays.css';

/** "Check your inbox" toast: the confirmation link itself arrives by email and opens the preferences page. */
export default function OptInMail() {
  const { optMail, setOptMail } = useStore();
  if (!optMail) return null;
  return (
    <div className="toast-opt">
      <i>✉</i>
      <div className="ov-opt-body">
        <b className="ov-opt-title">Confirm your email</b>
        <span className="ov-opt-text">We sent a link to <b>{optMail.email}</b>. You're subscribed only after you click it.</span>
        <div className="ov-opt-row">
          <button className="btn btn-pill ov-opt-ok" onClick={() => setOptMail(null)}>OK</button>
        </div>
      </div>
    </div>
  );
}
