// Create, read, update, change status and delete one quotation.
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { fail, nextSeq, tx, wrap } from '../util.js';
import { MANAGE, STATUSES, VIEW } from './constants.js';
import { parseQuoteBody } from './body.js';
import { load, saveLines } from './store.js';

/** Adds GET /:id, POST /, PUT /:id, POST /:id/status and DELETE /:id to the router. */
export function crudRoutes(router) {
  router.get('/:id', guard(VIEW), wrap(async (req, res) => res.json(await load(req.params.id))));

  router.post('/', guard(MANAGE), wrap(async (req, res) => {
    const b = parseQuoteBody(req.body);
    const out = await tx(async conn => {
      const yy = b.date.slice(2, 4);
      const seq = await nextSeq('quote_' + yy, 'quotations', 'A001PQT' + yy, 0);
      const id = 'A001PQT' + yy + seq.slice(('A001PQT' + yy).length).padStart(6, '0');
      await conn.query(`INSERT INTO quotations (id, quote_date, cust_type, customer_id, to_name, address, attend, desig, mobile, email, subject, intro, notes, valid_days, status, install_charge, transport_charge, discount, vat, total, net, signer_name, signer_desig, signer_dept, signer_cell, staff_name)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Draft',?,?,?,?,?,?,?,?,?,?,?)`,
      [id, b.date, b.custType, b.customerId, b.toName, b.address, b.attend, b.desig, b.mobile, b.email, b.subject, b.intro, b.notes, b.validDays, b.install, b.transport, b.discount, b.vat, b.total, b.net, b.signerName, b.signerDesig, b.signerDept, b.signerCell, req.staff.name]);
      await saveLines(conn, id, b.lines);
      return { id, net: b.net };
    });
    res.json(out);
  }));

  router.put('/:id', guard(MANAGE), wrap(async (req, res) => {
    const b = parseQuoteBody(req.body);
    await tx(async conn => {
      const [[cur]] = await conn.query('SELECT status FROM quotations WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!cur) throw fail(404, 'Quotation not found');
      if (cur.status === 'Accepted') throw fail(409, 'An accepted quotation cannot be edited. Make a copy instead.');
      await conn.query(`UPDATE quotations SET quote_date=?, cust_type=?, customer_id=?, to_name=?, address=?, attend=?, desig=?, mobile=?, email=?, subject=?, intro=?, notes=?, valid_days=?, install_charge=?, transport_charge=?, discount=?, vat=?, total=?, net=?, signer_name=?, signer_desig=?, signer_dept=?, signer_cell=? WHERE id = ?`,
        [b.date, b.custType, b.customerId, b.toName, b.address, b.attend, b.desig, b.mobile, b.email, b.subject, b.intro, b.notes, b.validDays, b.install, b.transport, b.discount, b.vat, b.total, b.net, b.signerName, b.signerDesig, b.signerDept, b.signerCell, req.params.id]);
      await saveLines(conn, req.params.id, b.lines);
    });
    res.json({ ok: true });
  }));

  router.post('/:id/status', guard(MANAGE), wrap(async (req, res) => {
    const status = req.body?.status;
    if (!STATUSES.includes(status)) throw fail(400, 'Unknown status');
    const [r] = await pool.query("UPDATE quotations SET status = ? WHERE id = ? AND status <> 'Accepted'", [status, req.params.id]);
    if (!r.affectedRows) {
      const [[q]] = await pool.query('SELECT status FROM quotations WHERE id = ?', [req.params.id]);
      throw q ? fail(409, 'An accepted quotation is locked. Make a copy instead.') : fail(404, 'Quotation not found');
    }
    res.json({ ok: true, status });
  }));

  router.delete('/:id', guard(MANAGE), wrap(async (req, res) => {
    await tx(async conn => {
      const [[cur]] = await conn.query('SELECT status FROM quotations WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!cur) throw fail(404, 'Quotation not found');
      if (cur.status === 'Accepted' || cur.status === 'Sent') throw fail(409, 'Only a draft or rejected quotation can be deleted');
      await conn.query('DELETE FROM quotation_items WHERE quote_id = ?', [req.params.id]);
      await conn.query('DELETE FROM quotations WHERE id = ?', [req.params.id]);
    });
    res.json({ ok: true });
  }));
}
