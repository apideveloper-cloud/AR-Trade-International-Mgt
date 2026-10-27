import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LOGO } from '../data.js';

/** The AR Trade logo, served from this app (public/site). If the file is ever missing it falls back to icon + name. */
export default function Brand({ size = 68, to = '/', className = '' }) {
  const [bad, setBad] = useState(false);
  return (
    <Link to={to} className={'brand-mark ' + className} aria-label="AR Trade International" style={{ '--s': size + 'px' }}>
      {bad ? (<><img src="/ar-icon-round.png" alt="" width={size} height={size} /><span>AR TRADE INTERNATIONAL</span></>)
        : <img className="wordmark" src={LOGO} alt="AR Trade International" style={{ height: size, width: 'auto' }} onError={() => setBad(true)} />}
    </Link>
  );
}
