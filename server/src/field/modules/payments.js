// Payment collection against invoices, with a money receipt (MR-nnnn).
//   GET  /api/field/payments/customers?q=     customers that have invoices: { id, name, area, due, invoices: [{ id, orderRef, date, total, paid, due, ageDays }] }
//   POST /api/field/payments                  { customerId, invoiceIds: [...], method: Cash|bKash|Cheque|Bank, amount, reference } -> receipt
//   GET  /api/field/payments?days=30&limit=   history (RM: own; manager/accountant/admin: everyone) + summary; used by the reports
// Partial payments are allowed: the amount (capped at the selected invoices' dues) settles the OLDEST selected invoice first.
// A cheque is recorded as ChequePending (it counts against the dues straight away, like in the design).
import { Router } from 'express';
import { pool, fail, wrap, guardRole, nextSeq, notify, staffIdsByRole, UTC, clientRefOf } from '../common.js';
import { bdDayStartUtc, customerById, seesAll } from '../sales_util.js';
import { addRange, addSearch, pageOf, whereOf, wantsPage } from '../../listing.js';

const router = Router();
const guardSales = guardRole('rm', 'manager', 'accountant');
const METHODS = ['Cash', 'bKash', 'Cheque', 'Bank'];
const REF_LABEL = { Cash: 'Receipt no.', bKash: 'Trx ID', Cheque: 'Cheque no.', Bank: 'Bank ref.' };

const invoiceOut = i => ({
  id: i.id, orderRef: i.order_ref || '', date: i.created_utc, total: i.total, paid: i.paid, due: Math.max(0, i.total - i.paid), ageDays: Number(i.age)
});
const INV_SELECT = `SELECT i.*, ${UTC('i.created_at')} created_utc, DATEDIFF(UTC_DATE(), DATE(i.created_at)) age FROM field_invoices i`;

// Optional (web console): ?from= &to= (invoice date), ?due=1 (only customers who still owe), ?page= &size= (one page of customers; the answer then
// also carries rows (= customers), total (matching customers) and summary { invoices, due, over30, fresh } over ALL matching customers).
// Without those parameters the answer is exactly what the mobile app has always received.
router.get('/customers', guardSales, wrap(async (req, res) => {
  const paged = wantsPage(req);
  const q = String(req.query.q || '').trim().slice(0, 60);
  const inv = [], iargs = [];
  addRange(inv, iargs, 'i.created_at', req);
  const exist = ['i.customer_id = c.id', ...inv, ...(req.query.due === '1' ? ['i.total > i.paid'] : [])];
  const cond = [`EXISTS (SELECT 1 FROM field_invoices i WHERE ${exist.join(' AND ')})`], args = [...iargs];
  if (paged) addSearch(cond, args, ['c.name', 'c.area', 'c.phone', 'c.contact_person'], req.query.q);
  else if (q) { cond.push('(c.name LIKE ? OR c.area LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  const where = whereOf(cond);
  const pg = paged ? pageOf(req, { def: 25, max: 200 }) : null;
  const [custs] = await pool.query(
    `SELECT c.id, c.name, c.area, c.phone, c.contact_person FROM field_customers c ${where} ORDER BY c.name${paged ? ', c.id LIMIT ? OFFSET ?' : ''}`,
    paged ? [...args, pg.size, pg.offset] : args);
  const ids = custs.map(c => c.id);
  const [invs] = ids.length ? await pool.query(`${INV_SELECT} WHERE i.customer_id IN (?)${inv.length ? ' AND ' + inv.join(' AND ') : ''} ORDER BY i.created_at, i.id`, [ids, ...iargs]) : [[]];
  const customers = custs.map(c => {
    const invoices = invs.filter(i => i.customer_id === c.id).map(invoiceOut);
    return { id: c.id, name: c.name, area: c.area || '', phone: c.phone || '', contact: c.contact_person || '', due: invoices.reduce((t, i) => t + i.due, 0), invoices };
  });
  if (!paged) return res.json({ withDue: customers.filter(c => c.due > 0).length, customers });
  const [[n]] = await pool.query(`SELECT COUNT(*) n FROM field_customers c ${where}`, args);
  const age = 'DATEDIFF(UTC_DATE(), DATE(i.created_at))', due = 'GREATEST(i.total - i.paid, 0)';
  const [[s]] = await pool.query(
    `SELECT COUNT(*) invoices, COALESCE(SUM(${due}), 0) due, COALESCE(SUM(CASE WHEN ${age} >= 31 THEN ${due} END), 0) over30,
            COALESCE(SUM(CASE WHEN ${age} BETWEEN 0 AND 15 THEN ${due} END), 0) fresh, COUNT(DISTINCT CASE WHEN i.total > i.paid THEN i.customer_id END) with_due
     FROM field_invoices i WHERE i.customer_id IN (SELECT c.id FROM field_customers c ${where})${inv.length ? ' AND ' + inv.join(' AND ') : ''}`, [...args, ...iargs]);
  res.json({
    withDue: Number(s.with_due), customers, rows: customers, total: n.n,
    summary: { invoices: Number(s.invoices), due: Number(s.due), over30: Number(s.over30), fresh: Number(s.fresh) }
  });
}));

const receiptOut = async (p, customer) => {
  const [[bal]] = await pool.query('SELECT COALESCE(SUM(total - paid), 0) due FROM field_invoices WHERE customer_id = ?', [p.customer_id]);
  const [[at]] = await pool.query(`SELECT ${UTC('created_at')} at FROM field_payments WHERE id = ?`, [p.id]);
  return { id: p.id, customer: customer.name, customerId: p.customer_id, method: p.method, referenceLabel: REF_LABEL[p.method], reference: p.reference, amount: p.amount,
    invoices: String(p.invoice_refs || '').split(', ').filter(Boolean), status: p.status, by: '', at: at.at, balance: Number(bal.due) };
};

router.post('/', guardSales, wrap(async (req, res) => {
  const ref = clientRefOf(req.body);
  if (ref) { // a retry of a payment this person already posted: return the same receipt, do not post it twice
    const [[dup]] = await pool.query('SELECT * FROM field_payments WHERE staff_id = ? AND client_ref = ? LIMIT 1', [req.staff.id, ref]);
    if (dup) {
      const [[c]] = await pool.query('SELECT name FROM field_customers WHERE id = ?', [dup.customer_id]);
      const r = await receiptOut(dup, { name: c?.name || '' });
      return res.json({ ...r, by: req.staff.name });
    }
  }
  const customer = await customerById(parseInt(req.body.customerId, 10));
  const method = METHODS.includes(req.body.method) ? req.body.method : null;
  if (!method) throw fail(400, 'Choose a payment method');
  const reference = String(req.body.reference || '').trim().slice(0, 80);
  if (method !== 'Cash' && !reference) throw fail(400, `Enter the ${REF_LABEL[method].toLowerCase()}`);
  const ids = [...new Set((Array.isArray(req.body.invoiceIds) ? req.body.invoiceIds : []).map(String))];
  if (!ids.length) throw fail(400, 'Select at least one invoice');
  let amount = Math.round(Number(req.body.amount));
  if (!(amount > 0)) throw fail(400, 'Enter the amount received');

  const conn = await pool.getConnection();
  let receipt;
  try {
    await conn.beginTransaction();
    const [invs] = await conn.query('SELECT * FROM field_invoices WHERE id IN (?) AND customer_id = ? ORDER BY created_at, id FOR UPDATE', [ids, customer.id]);
    if (invs.length !== ids.length) throw fail(400, 'An invoice does not belong to this customer');
    const open = invs.filter(i => i.total - i.paid > 0);
    const dueTotal = open.reduce((t, i) => t + (i.total - i.paid), 0);
    if (!open.length) throw fail(409, 'The selected invoices are already paid');
    amount = Math.min(amount, dueTotal);

    const id = await nextSeq('field_mr', 'field_payments', 'MR-', 5118);
    let left = amount;
    const parts = [];
    for (const i of open) {
      if (left <= 0) break;
      const due = i.total - i.paid, pay = Math.min(due, left);
      await conn.query('UPDATE field_invoices SET paid = paid + ? WHERE id = ?', [pay, i.id]);
      await conn.query('INSERT INTO field_payment_items (payment_id, invoice_id, amount) VALUES (?,?,?)', [id, i.id, pay]);
      parts.push(pay < due ? `${i.id} (part)` : i.id);
      left -= pay;
    }
    const status = method === 'Cheque' ? 'ChequePending' : 'Received';
    await conn.query('INSERT INTO field_payments (id, invoice_id, invoice_refs, customer_id, staff_id, method, amount, reference, status, client_ref, created_at) VALUES (?,?,?,?,?,?,?,?,?,?, UTC_TIMESTAMP())',
      [id, open[0].id, parts.join(', '), customer.id, req.staff.id, method, amount, reference, status, ref]);
    const [[bal]] = await conn.query('SELECT COALESCE(SUM(total - paid), 0) due FROM field_invoices WHERE customer_id = ?', [customer.id]);
    await conn.commit();
    receipt = { id, customer: customer.name, customerId: customer.id, method, referenceLabel: REF_LABEL[method], reference, amount, invoices: parts, status, by: req.staff.name, at: new Date().toISOString(), balance: Number(bal.due) };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

  staffIdsByRole('accountant', 'manager').then(list => notify(list.filter(i => i !== req.staff.id), {
    icon: 'payments', cat: 'Updates', title: 'Payment received', sub: `${receipt.id} · ${customer.name} · ৳ ${amount.toLocaleString('en-IN')}`,
    body: `${req.staff.name} collected ৳ ${amount.toLocaleString('en-IN')} from ${customer.name} (${method}).`,
    rows: [['Receipt', receipt.id], ['Customer', customer.name], ['Method', method], ['Invoices', receipt.invoices.join(', ')]] }));
  res.json(receipt);
}));

router.get('/', guardSales, wrap(async (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const own = !seesAll(req.staff);
  const [rows] = await pool.query(
    `SELECT p.*, c.name customer, s.name staff_name, ${UTC('p.created_at')} created_utc
     FROM field_payments p JOIN field_customers c ON c.id = p.customer_id JOIN staff s ON s.id = p.staff_id
     WHERE p.created_at >= UTC_TIMESTAMP() - INTERVAL ? DAY ${own ? 'AND p.staff_id = ?' : ''} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
    own ? [days, req.staff.id, limit] : [days, limit]);
  const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(amount), 0) total FROM field_payments p WHERE p.status <> 'Bounced' AND p.created_at >= ? ${own ? 'AND p.staff_id = ?' : ''}`, own ? [bdDayStartUtc(), req.staff.id] : [bdDayStartUtc()]);
  res.json({
    summary: { collectedToday: Number(t.total), receiptsToday: t.n },
    items: rows.map(p => ({
      id: p.id, customerId: p.customer_id, customer: p.customer, invoices: p.invoice_refs, by: p.staff_name, method: p.method, amount: p.amount,
      reference: p.reference, status: p.status, at: p.created_utc
    }))
  });
}));

export default router;
