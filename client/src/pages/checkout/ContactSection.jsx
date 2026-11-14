import { MOBILE_HINT, bdMobile, mobileProblem, showMobile, toAsciiDigits } from '../../phone.js';

/** Checkout step 1: name, mobile number and optional email. `f` is the field-error helper, `defaults` the prefilled values. */
export default function ContactSection({ f, defaults }) {
  const { errs, setErrs, clr, fe, bad } = f;
  const onPhoneChange = e => { const m = mobileProblem(toAsciiDigits(e.target.value)); setErrs(x => (x.phone || m) ? { ...x, phone: m } : x); };
  const onPhoneBlur = e => {
    const v = toAsciiDigits(e.target.value).trim(), n = bdMobile(v);
    if (!v) return;
    if (n) { e.target.value = showMobile(n); clr('phone'); } else setErrs(x => ({ ...x, phone: MOBILE_HINT }));
  };
  return (
    <div className="cardbox">
      <div className="co-h"><i>1</i><div><b>Contact</b><small>Who should we call about this order?</small></div></div>
      <div className="two co-contact">
        <label className="lbl"><span>Full name <i className="req" aria-hidden="true">*</i></span><input className={'field' + bad('name')} name="name" required aria-required="true" aria-invalid={!!errs.name} aria-describedby={errs.name ? 'err-name' : undefined} autoComplete="name" defaultValue={defaults.name} onChange={() => clr('name')} />{fe('name')}</label>
        <label className="lbl"><span>Mobile number <i className="req" aria-hidden="true">*</i></span><input className={'field' + bad('phone')} name="phone" type="tel" required aria-required="true" aria-invalid={!!errs.phone} aria-describedby={errs.phone ? 'err-phone' : undefined} autoComplete="tel" inputMode="tel" maxLength={18} defaultValue={defaults.phone} placeholder="01XXX-XXXXXX" onChange={onPhoneChange} onBlur={onPhoneBlur} />
          {fe('phone')}</label>
        <label className="lbl"><span>Email <span className="lbl-opt">(optional)</span></span><input className={'field' + bad('email')} name="email" type="email" aria-invalid={!!errs.email} aria-describedby={errs.email ? 'err-email' : undefined} autoComplete="email" defaultValue={defaults.email} onChange={() => clr('email')} />{fe('email')}</label>
      </div>
    </div>
  );
}
