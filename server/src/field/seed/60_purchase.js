// Demo purchase data from the app design: requisition PR-0219 (HP 79A x 50, stock low) with three vendor quotes,
// a submitted PO for the manager to approve, and the expense claims shown on the Approvals screen. Idempotent.
const VENDORS = [
  ['Global Toner BD', 'Vendor · Toner supplier', '01711-908812', 'sales@globaltonerbd.com', 'Elephant Rd, Dhaka'],
  ['HP Authorized — Smart', 'Vendor · HP distributor', '01713-905520', 'orders@smarttech.com.bd', 'Bashundhara City, Dhaka'],
  ['Techno Supplies', 'Vendor · Printer parts', '01915-270044', 'info@technosupplies.com.bd', 'Nawabpur, Dhaka']
];

const day = n => new Date(Date.now() + 6 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

export default async function seed({ pool }) {
  for (const [name, kind, phone, email, address] of VENDORS) {
    await pool.query('INSERT IGNORE INTO field_vendors (name, kind, phone, email, address) VALUES (?,?,?,?,?)', [name, kind, phone, email, address]);
  }
  const [vend] = await pool.query('SELECT id, name FROM field_vendors WHERE name IN (?)', [VENDORS.map(v => v[0])]);
  const vid = Object.fromEntries(vend.map(v => [v.name, v.id]));
  const [[buyer]] = await pool.query("SELECT id FROM staff WHERE email = 'purchase@artradeinternational.com'");

  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM field_purchase_requests');
  if (!n) {
    const [[p]] = await pool.query("SELECT id FROM products WHERE name LIKE '%79A%' ORDER BY id LIMIT 1").catch(() => [[null]]);
    await pool.query('INSERT INTO field_purchase_requests (id, product_id, product_name, qty, need_by, stock_now, stock_min, requested_by, staff_id) VALUES (?,?,?,?,?,?,?,?,?)',
      ['PR-0219', p ? p.id : null, 'HP 79A Black Toner (CF279A)', 50, day(5), 8, 20, 'Store', buyer ? buyer.id : null]);
    for (const [name, price, days, rating] of [['Global Toner BD', 8150, 5, 4.2], ['HP Authorized — Smart', 7900, 2, 4.8], ['Techno Supplies', 7650, 7, 3.9]]) {
      await pool.query('INSERT IGNORE INTO field_vendor_quotes (pr_id, vendor_id, unit_price, delivery_days, rating) VALUES (?,?,?,?,?)', ['PR-0219', vid[name], price, days, rating]);
    }
  }

  const [[{ po }]] = await pool.query('SELECT COUNT(*) po FROM field_purchase_orders');
  if (!po && buyer) {
    const qty = 20, price = 4900, sub = qty * price, vat = Math.round(sub * 0.05), freight = 1500;
    await pool.query(`INSERT INTO field_purchase_orders (id, vendor_id, staff_id, status, subtotal, vat, freight, grand_total, deliver_by, payment_terms, deliver_to, submitted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, UTC_TIMESTAMP())`, ['PO-0883', vid['Techno Supplies'], buyer.id, 'Submitted', sub, vat, freight, sub + vat + freight, day(6), '30 days', 'Warehouse · Tejgaon']);
    await pool.query('INSERT INTO field_purchase_order_items (po_id, name, sku, qty, unit_price) VALUES (?,?,?,?,?)', ['PO-0883', 'Canon 071 Black Toner', '071', qty, price]);
  }

  // expense claims of the Approvals screen (only when those people have none yet)
  const claims = [
    ['rm@artradeinternational.com', 'Client lunch', 'Food', 820, null],
    ['sumaiya.akter@artradeinternational.com', 'CNG fare', 'Transport', 500, null],
    ['mahmud.karim@artradeinternational.com', 'Courier charge', 'Other', 260, 'Verified with voucher']
  ];
  for (const [email, title, category, amount, remark] of claims) {
    const [[s]] = await pool.query('SELECT id FROM staff WHERE email = ?', [email]);
    if (!s) continue;
    const [[e]] = await pool.query('SELECT id FROM field_expenses WHERE staff_id = ? AND title = ?', [s.id, title]);
    if (e) continue;
    if (remark) {
      const [[m]] = await pool.query("SELECT id FROM staff WHERE email = 'accounts@artradeinternational.com'");
      await pool.query("INSERT INTO field_expenses (staff_id, title, category, amount, status, decided_by, decided_at, remarks) VALUES (?,?,?,?, 'Approved', ?, UTC_TIMESTAMP(), ?)", [s.id, title, category, amount, m ? m.id : null, remark]);
    } else {
      await pool.query('INSERT INTO field_expenses (staff_id, title, category, amount) VALUES (?,?,?,?)', [s.id, title, category, amount]);
    }
  }
}
