/** Turns a send() answer into a { ok, text } line for the owner. Keeps 400/409/503 bodies readable. */
export function rvMsg(r, okText) {
  if (r.ok) return { ok: true, text: okText || 'Done.' };
  const b = r.body || {};
  const text = b.error || b.hint || b.message || (r.status === 503 ? 'E-mail is not set up yet.' : r.status >= 500 ? 'The server had a problem. Please try again.' : 'Something went wrong. Please try again.');
  return { ok: false, text: b.hint && b.error && !String(b.error).includes(b.hint) ? b.error + ' ' + b.hint : text };
}
export const RV_STATUS = [['', 'All'], ['queued', 'Waiting to send'], ['sent', 'Sent'], ['opened', 'Opened'], ['reviewed', 'Reviewed'], ['expired', 'Expired'], ['failed', 'Failed']];
export const RV_STATUS_TEXT = { queued: 'Waiting to send', sent: 'Sent', opened: 'Opened', reviewed: 'Reviewed', expired: 'Expired', failed: 'Failed', cancelled: 'Cancelled' };
export const RvMsg = ({ m }) => (m ? <div className={m.ok ? 'adrv-msg-ok' : 'adrv-msg-bad'} role="status">{m.text}</div> : null);
