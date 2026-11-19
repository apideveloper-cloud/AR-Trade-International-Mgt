import './app.css';

/** Shown when the signed-in role has no admin console page at all. */
export function NoAccess({ role, onSignOut }) {
  return (
    <div className="xapp-none">
      <div className="a-msg err">Your role ({role}) has no admin console pages. Use the mobile app, or ask the Master Admin to grant access.</div>
      <button className="a-btn" onClick={onSignOut}>Sign out</button>
    </div>
  );
}
