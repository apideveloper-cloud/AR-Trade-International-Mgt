import { Fragment } from 'react';
import './checkout-steps.css';

const ICON = {
  cart: <path d="M3 4h2l2.2 10.2a1.6 1.6 0 0 0 1.6 1.3h7.4a1.6 1.6 0 0 0 1.6-1.2L19.5 8H6.2M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01" />,
  details: <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8 9h8M8 13h8M8 17h5" />,
  done: <path d="M6 20V5m0 0h11l-2 4 2 4H6" />
};
const STEPS = [['Cart', 'cart'], ['Details', 'details'], ['Confirmation', 'done']];

/** Order progress as a tracker: finished steps are ticked, the current step pulses and a light runs along the road to the next one. step 0-2 = current step, 3 = everything done. */
export default function CheckoutSteps({ step = 1 }) {
  return (
    <ol className={'cks' + (step >= 3 ? ' all' : '')} aria-label="Checkout progress">
      {STEPS.map(([t, ic], i) => (
        <Fragment key={t}>
          {i > 0 && <li className={'cks-line' + (i <= step ? ' done' : i === step + 1 ? ' next' : '')} style={{ '--i': i }} aria-hidden="true" />}
          <li className={'cks-i' + (i < step ? ' done' : i === step ? ' cur' : '')} style={{ '--i': i }} aria-current={i === step ? 'step' : undefined}>
            <span className="cks-dot">
              {i < step
                ? <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.2 8.4l3 3 6.6-6.8" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                : <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[ic]}</svg>}
            </span>
            <span className="cks-t">{t}</span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
