import { Link } from 'react-router-dom';

export const Switch = ({ on, onClick }) => <button type="button" onClick={onClick} style={{ width: 44, height: 26, borderRadius: 999, border: 0, background: on ? 'oklch(0.58 0.14 150)' : '#cfd5e1', position: 'relative', padding: 0, flexShrink: 0 }}><span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} /></button>;
export const Note = ({ children }) => <span className="em-s1">{children}</span>;
export const NoProvider = ({ connected }) => (connected ? null : (
  <div className="em-s2">
    <span className="em-s3">!</span>
    <span><b>No email provider is connected.</b> Campaigns and automations are recorded and counted, but nothing is delivered until you connect one in <Link to="/email/setup" className="em-s4">Sending &amp; compliance</Link>.</span>
  </div>
));
