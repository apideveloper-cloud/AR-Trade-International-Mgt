import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/shell.js';
import './app.css';

/** Shown when the signed-in role has no admin console page at all. */
export function NoAccess({ role, onSignOut }) {
  const tr = useT();
  return (
    <div className="xapp-none">
      <div className="a-msg err">{tr('Your role ({role}) has no admin console pages. Use the mobile app, or ask the Master Admin to grant access.', { role })}</div>
      <button className="a-btn" onClick={onSignOut}>{tr('Sign out')}</button>
    </div>
  );
}
