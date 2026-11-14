import { useState } from 'react';

/** A label / value line of an order summary. */
export const Row = ({ k, v, cls }) => <div className={cls ? 'r ' + cls : 'r'}><span>{k}</span><span>{v}</span></div>;

/** Coupon code input with the "applied" tick. */
export function CouponBox({ value, onChange, ok }) {
  return (
    <>
      <input className="pill-in" value={value} onChange={e => onChange(e.target.value)} placeholder="Coupon code" />
      {ok && <span className="ct-coupon-ok">✓ Coupon applied</span>}
    </>
  );
}

/** Inline form errors: one message per field, with the helpers that render and clear them. */
export function useFieldErrors() {
  const [errs, setErrs] = useState({});
  const clr = k => setErrs(x => (x[k] ? { ...x, [k]: '' } : x));
  const fe = k => (errs[k] ? <small id={'err-' + k} className="fld-err" role="alert">{errs[k]}</small> : null);
  const bad = k => (errs[k] ? ' bad' : '');
  return { errs, setErrs, clr, fe, bad };
}
