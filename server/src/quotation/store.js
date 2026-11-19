// Database reads and writes shared by the quotation routes.
import { pool } from '../db.js';
import { D, fail } from '../util.js';
import { addSearch, whereOf } from '../listing.js';

/** Database row -> the JSON the admin screens expect. */
export const qOut = r => ({
  id: r.id, date: r.d, custType: r.cust_type, customerId: r.customer_id, toName: r.to_name, address: r.address, attend: r.attend, desig: r.desig, mobile: r.mobile, email: r.email, subject: r.subject, intro: r.intro || '', notes: r.notes || '', validDays: r.valid_days, status: r.status,
  install: r.install_charge, transport: r.transport_charge, discount: r.discount, vat: r.vat, total: r.total, net: r.net,
  signerName: r.signer_name, signerDesig: r.signer_desig, signerDept: r.signer_dept, signerCell: r.signer_cell, by: r.staff_name, createdAt: r.created_at, updatedAt: r.updated_at
});

/** One quotation with its item lines; throws 404 when it does not exist. */
export async function load(id) {
  const [[r]] = await pool.query(`SELECT *, ${D('quote_date')} d FROM quotations WHERE id = ?`, [id]);
  if (!r) throw fail(404, 'Quotation not found');
  const [items] = await pool.query('SELECT product_id, description, qty, unit, warranty, unit_price FROM quotation_items WHERE quote_id = ? ORDER BY sl, id', [id]);
  return { ...qOut(r), lines: items.map(i => ({ productId: i.product_id, description: i.description, qty: i.qty, unit: i.unit, warranty: i.warranty, unitPrice: i.unit_price, amount: i.qty * i.unit_price })) };
}

/** Replaces all item lines of a quotation inside a transaction. */
export async function saveLines(conn, id, lines) {
  await conn.query('DELETE FROM quotation_items WHERE quote_id = ?', [id]);
  for (const [i, l] of lines.entries()) await conn.query('INSERT INTO quotation_items (quote_id, sl, product_id, description, qty, unit, warranty, unit_price) VALUES (?,?,?,?,?,?,?,?)', [id, i + 1, l.productId, l.description, l.qty, l.unit, l.warranty, l.unitPrice]);
}

/** Company details (address, phone, email) kept in the settings table; {} when missing. */
export const siteInfo = async () => { try { return JSON.parse((await pool.query('SELECT v FROM settings WHERE k = "site"'))[0][0]?.v || '{}'); } catch { return {}; } };

/** Customers to choose from when writing a quotation or an order: Existing = active field customers, Upcoming = prospects. */
export async function fieldCustomers(type, search) {
  const cond = [type === 'Upcoming' ? "kind = 'Upcoming'" : "kind <> 'Upcoming'"], args = [];
  addSearch(cond, args, ['name', 'contact_person', 'phone', 'email', 'area'], search);
  const [rows] = await pool.query(`SELECT id, name, contact_person, contact_role, phone, email, address, area FROM field_customers ${whereOf(cond)} ORDER BY name LIMIT 12`, args).catch(() => [[]]);
  return rows.map(r => ({ id: r.id, name: r.name, contact: r.contact_person, role: r.contact_role, phone: r.phone, email: r.email, address: [r.address, r.area].filter(Boolean).join(', ') }));
}
