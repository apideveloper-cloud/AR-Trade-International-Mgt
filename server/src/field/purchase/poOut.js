// Purchase order reading: the shared SELECT, the app payload (poOut), loading one order and who may touch it.
import { pool, fail, roleKey } from '../common.js';
import { D } from '../../util.js';
import { STATUS_KEY, budgetOf } from './calc.js';

const T = c => `DATE_FORMAT(${c}, '%Y-%m-%dT%H:%i:%sZ')`;

export const PO_SELECT = `SELECT p.*, ${D('p.deliver_by')} deliver_by_d, ${T('p.created_at')} created_utc, ${T('p.submitted_at')} submitted_utc,
  ${T('p.manager_at')} manager_utc, ${T('p.final_at')} final_utc, ${T('p.rejected_at')} rejected_utc,
  v.name vendor_name, v.email vendor_email, v.phone vendor_phone, s.name staff_name, mb.name manager_name, fb.name final_name, rb.name rejected_name,
  (SELECT COUNT(*) FROM field_purchase_order_items i WHERE i.po_id = p.id) line_count,
  (SELECT COALESCE(SUM(qty), 0) FROM field_purchase_order_items i WHERE i.po_id = p.id) pcs
  FROM field_purchase_orders p
  JOIN field_vendors v ON v.id = p.vendor_id JOIN staff s ON s.id = p.staff_id
  LEFT JOIN staff mb ON mb.id = p.manager_by LEFT JOIN staff fb ON fb.id = p.final_by LEFT JOIN staff rb ON rb.id = p.rejected_by`;

/** The requisition SELECT shared by the list, detail and create-order routes (append a WHERE). */
export const PR_SELECT = `SELECT (SELECT p.img FROM products p WHERE p.id = r.product_id) img, r.id, r.product_id, r.product_name, r.qty, ${D('r.need_by')} need_by, r.stock_now, r.stock_min, r.requested_by, r.status, ${T('r.created_at')} created_at FROM field_purchase_requests r`;

/** What the caller may do with an order (own orders; admin everything). */
export function permissionsOf(p, staff) {
  const own = p.staff_id === staff.id || roleKey(staff.role) === 'admin';
  return {
    edit: own && p.status === 'Draft',
    submit: own && p.status === 'Draft',
    reopen: own && (p.status === 'Submitted' || p.status === 'Rejected'),
    delete: own && p.status === 'Draft'
  };
}

/** One purchase order row -> app payload; with lines it also loads them, with `staff` it adds `can`. */
export async function poOut(p, withLines = true, staff = null) {
  const out = {
    id: p.id, prId: p.pr_id, vendorId: p.vendor_id, vendor: p.vendor_name, status: STATUS_KEY[p.status], statusLabel: p.status,
    by: p.staff_name, staffId: p.staff_id, rev: p.rev, grand: p.grand_total, subtotal: p.subtotal, vat: p.vat, freight: p.freight,
    pcs: Number(p.pcs), lineCount: Number(p.line_count), deliverBy: p.deliver_by_d, paymentTerms: p.payment_terms, deliverTo: p.deliver_to, note: p.note,
    createdAt: p.created_utc, submittedAt: p.submitted_utc, ...budgetOf(p.grand_total),
    trail: {
      manager: p.manager_by ? { by: p.manager_name, at: p.manager_utc, remarks: p.manager_remarks } : null,
      final: p.final_by ? { by: p.final_name, at: p.final_utc, remarks: p.final_remarks } : null,
      rejected: p.rejected_by ? { by: p.rejected_name, at: p.rejected_utc, remarks: p.reject_remarks } : null
    }
  };
  if (staff) out.can = permissionsOf(p, staff);
  if (withLines) {
    const [lines] = await pool.query('SELECT i.id, i.product_id, i.name, i.sku, i.qty, i.unit_price, (SELECT p.img FROM products p WHERE p.id = i.product_id) img FROM field_purchase_order_items i WHERE i.po_id = ? ORDER BY i.id', [p.id]);
    out.lines = lines.map(l => ({ id: l.id, productId: l.product_id, img: l.img || '', name: l.name, sku: l.sku, qty: l.qty, unitPrice: l.unit_price, total: l.qty * l.unit_price }));
  }
  return out;
}

/** Loads one order (with names and counts) or throws 404. */
export async function loadPo(id) {
  const [[p]] = await pool.query(`${PO_SELECT} WHERE p.id = ?`, [id]);
  if (!p) throw fail(404, 'Purchase order not found');
  return p;
}

/** Purchase officers see only their own orders; manager / accountant / admin see all. */
export const seesAll = staff => roleKey(staff.role) !== 'purchase';

/** Only the owner (or an admin) may change an order. */
export function mayTouch(staff, p) {
  if (p.staff_id !== staff.id && roleKey(staff.role) !== 'admin') throw fail(403, 'This purchase order belongs to someone else');
}
