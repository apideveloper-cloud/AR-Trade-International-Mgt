import { useState } from 'react';

/** A small product picture; when there is none (or it fails to load) the first letter of the name sits on a soft tile instead. */
export function ProdThumb({ src, name, size = 38 }) {
  const [bad, setBad] = useState(false);
  if (src && !bad) return <img className="pt" src={src} alt="" loading="lazy" width={size} height={size} onError={() => setBad(true)} />;
  return <span className="pt none" style={{ width: size, height: size }} aria-hidden="true">{String(name || '?').trim().charAt(0).toUpperCase()}</span>;
}
