import { Link } from 'react-router-dom';

/** On/off toggle (the track and knob look lives in emailInline.css). */
export const Switch = ({ on, onClick }) => <button type="button" onClick={onClick} className={'em-switch' + (on ? ' em-switch--on' : '')}><span className="em-switch-knob" /></button>;
export const Note = ({ children }) => <span className="em-note">{children}</span>;
export const NoProvider = ({ connected }) => (connected ? null : (
  <div className="em-alert">
    <span className="em-alert-icon">!</span>
    <span><b>No email provider is connected.</b> Campaigns and automations are recorded and counted, but nothing is delivered until you connect one in <Link to="/email/setup" className="em-alert-link">Sending &amp; compliance</Link>.</span>
  </div>
));
/** Green (ok) or amber (warn) status pill, e.g. Sent / Scheduled / Verified / Not found. */
export const Pill = ({ ok, className = '', children }) => <span className={`em-pill em-pill--${ok ? 'ok' : 'warn'} ${className}`.trim()}>{children}</span>;
/** Header strip of a card: a title (or any left content) and an optional right side. */
export const PanelHead = ({ center, plain, children }) => <div className={'em-panel-head' + (center ? ' em-panel-head--center' : '') + (plain ? ' em-panel-head--plain' : '')}>{children}</div>;
