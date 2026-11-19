// Getting a quotation to the customer: PDF, e-mail, and a share link.
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { esc, fail, wrap } from '../util.js';
import { mailReady, mailSetupHint, sendMail } from '../mailer.js';
import { money } from '../invoice.js';
import { MANAGE, VIEW } from './constants.js';
import { EMAIL_RE, addressList } from './terms.js';
import { load, siteInfo } from './store.js';
import { buildQuotePdf } from './pdf.js';

/** Adds GET /:id/pdf, POST /:id/email, POST /:id/share and GET /shared/:file to the router. */
export function shareRoutes(router) {
  router.get('/:id/pdf', guard(VIEW), wrap(async (req, res) => {
    const q = await load(req.params.id);
    const pdf = await buildQuotePdf(q, await siteInfo());
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${q.id}.pdf"`, 'Cache-Control': 'no-store' }).send(pdf);
  }));

  router.post('/:id/email', guard(MANAGE), wrap(async (req, res) => {
    const q = await load(req.params.id);
    const to = String(req.body?.to || q.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(to) || to.length > 160) throw fail(400, 'Enter one valid email address for the customer');
    const cc = addressList(req.body?.cc, 'CC').filter(a => a !== to);
    const bcc = addressList(req.body?.bcc, 'BCC').filter(a => a !== to && !cc.includes(a));
    if (!mailReady('quote')) throw fail(409, 'Email sending is not set up yet. ' + mailSetupHint('quote'));
    const site = await siteInfo();
    const note = String(req.body?.message || '').trim().slice(0, 1000);
    const pdf = await buildQuotePdf(q, site);
    await sendMail({
      channel: 'quote', to, cc: cc.length ? cc : undefined, bcc: bcc.length ? bcc : undefined, replyTo: site.email || undefined, subject: `Quotation ${q.id} from AR Trade International`,
      text: `Dear ${q.attend || q.toName},\n\n${note ? note + '\n\n' : ''}Please find our quotation ${q.id}${q.subject ? ' (' + q.subject + ')' : ''} attached as a PDF.\n\nNet payable: ${money(q.net)}\nValid for ${q.validDays} days.\n\nBest regards,\n${q.signerName || 'AR Trade International'}\nAR Trade International`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#0b1631"><p>Dear ${esc(q.attend || q.toName)},</p>${note ? `<p style="white-space:pre-wrap">${esc(note)}</p>` : ''}<p>Please find our quotation <b>${esc(q.id)}</b>${q.subject ? ' (' + esc(q.subject) + ')' : ''} attached as a PDF.</p><p>Net payable: <b>${esc(money(q.net))}</b><br>Valid for ${q.validDays} days.</p><p>Best regards,<br>${esc(q.signerName || 'AR Trade International')}<br>AR Trade International</p></div>`,
      attachments: [{ filename: q.id + '.pdf', content: pdf, contentType: 'application/pdf' }]
    });
    if (q.status === 'Draft') await pool.query("UPDATE quotations SET status = 'Sent' WHERE id = ? AND status = 'Draft'", [q.id]);
    res.json({ ok: true, to, cc, bcc });
  }));

  // A quotation gets a long random token the first time it is shared. Anyone holding the link can open that one PDF, nothing else.
  router.post('/:id/share', guard(MANAGE), wrap(async (req, res) => {
    const [[r]] = await pool.query('SELECT id, share_token FROM quotations WHERE id = ?', [req.params.id]);
    if (!r) throw fail(404, 'Quotation not found');
    const token = r.share_token || crypto.randomBytes(24).toString('hex');
    if (!r.share_token) await pool.query('UPDATE quotations SET share_token = ? WHERE id = ?', [token, r.id]);
    await pool.query("UPDATE quotations SET status = 'Sent' WHERE id = ? AND status = 'Draft'", [r.id]);
    res.json({ token });
  }));
  router.get('/shared/:file', wrap(async (req, res) => {
    const m = String(req.params.file).match(/^([a-f0-9]{48})\.pdf$/);
    if (!m) throw fail(404, 'This link is not valid');
    const [[r]] = await pool.query('SELECT id FROM quotations WHERE share_token = ?', [m[1]]);
    if (!r) throw fail(404, 'This link is not valid any more');
    const q = await load(r.id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${q.id}.pdf"`, 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }).send(await buildQuotePdf(q, await siteInfo()));
  }));
}
