// Demo data for Sales & collection: customers with open invoices, five deliveries (two delivered, one on the way,
// two ready) and a few money receipts — the numbers of the app design. Runs once (skipped when orders already exist).
const CUSTOMERS = [
  // name, contact, phone, area, address, credit limit
  ['Jamuna Bank', 'Kamrul Hasan', '01711-204587', 'Dilkusha', 'Motijheel C/A, 3rd floor, IT dept.', 500000],
  ['BRAC Bank', 'Farzana Rahman', '01819-332140', 'Gulshan-1', 'Gulshan-1, Level 6, Admin', 400000],
  ['Walton Plaza', 'Sohel Rana', '01755-918823', 'Motijheel', 'Motijheel, Accounts desk', 300000],
  ['Square Pharma', 'Arif Chowdhury', '01713-447210', 'Mohakhali', 'Mohakhali, IT store room', 300000],
  ['City Bank', 'Nadia Islam', '01912-556031', 'Uttara', 'Uttara, Sector 4', 300000],
  ['IDLC Finance', 'Nusrat Jahan', '01730-118862', 'Gulshan Ave', 'Gulshan Ave, Floor 9', 300000],
  ['ACI Limited', 'Rezaul Karim', '01733-210045', 'Tejgaon I/A', 'Tejgaon Industrial Area', 300000],
  ['Dhaka WASA', 'Habibur Rahman', '01552-301877', 'Kawran Bazar', 'Kawran Bazar', 200000]
];

// customer, [invoice, order ref, total, paid, age in days]
const INVOICES = [
  ['Walton Plaza', [['INV-2041', 'SO-1188', 48500, 16500, 20], ['INV-2077', 'SO-1214', 32000, 0, 11], ['INV-2102', 'SO-1240', 18600, 0, 3]]],
  ['Jamuna Bank', [['INV-2066', 'SO-1201', 64200, 30000, 14], ['INV-2110', 'SO-1252', 24900, 0, 1]]],
  ['City Bank', [['INV-2058', 'SO-1195', 32000, 0, 17]]],
  ['BRAC Bank', [['INV-2049', 'SO-1191', 41800, 20000, 18], ['INV-2115', 'SO-1258', 12600, 0, 0]]],
  ['Square Pharma', [['INV-2083', 'SO-1219', 27400, 0, 9]]],
  ['IDLC Finance', [['INV-2071', 'SO-1209', 36500, 10000, 12], ['INV-2098', 'SO-1236', 15200, 0, 4]]],
  ['ACI Limited', [['INV-2062', 'SO-1198', 52300, 25000, 15]]],
  ['Dhaka WASA', [['INV-2090', 'SO-1228', 19800, 0, 7]]]
];

// order, delivery, customer, item count, status, eta / time
const DELIVERIES = [
  ['SO-2026-1039', 'DN-0579', 'BRAC Bank', 4, 'Delivered', '10:05 AM'],
  ['SO-2026-1041', 'DN-0580', 'Square Pharma', 2, 'Delivered', '10:52 AM'],
  ['SO-2026-1047', 'DN-0583', 'Jamuna Bank', 6, 'OnTheWay', 'ETA 11:45'],
  ['SO-2026-1050', 'DN-0585', 'Walton Plaza', 3, 'Ready', 'ETA 1:30 PM'],
  ['SO-2026-1052', 'DN-0586', 'IDLC Finance', 5, 'Ready', 'ETA 3:15 PM']
];

// days ago, customer, receipt, invoices, who, amount, method, status
const RECEIPTS = [
  [0, 'Jamuna Bank', 'MR-5118', 'INV-2066 (part)', 'Sumaiya Akter', 30000, 'bKash', 'Received'],
  [0, 'Square Pharma', 'MR-5117', 'INV-2083', 'Rafiq Hasan', 12400, 'Cash', 'Received'],
  [1, 'City Bank', 'MR-5116', 'INV-2058', 'Mahmud Karim', 28500, 'Cheque', 'ChequePending'],
  [1, 'Walton Plaza', 'MR-5115', 'INV-2041 (part)', 'Rafiq Hasan', 16500, 'Cash', 'Received'],
  [1, 'IDLC Finance', 'MR-5114', 'INV-2071 (part)', 'Sumaiya Akter', 9800, 'bKash', 'Received'],
  [2, 'BRAC Bank', 'MR-5113', 'INV-2049 (part)', 'Farhan Rahman', 42000, 'Bank', 'Received']
];

export default async function seed({ pool }) {
  const [[have]] = await pool.query('SELECT COUNT(*) n FROM field_sales_orders');
  if (have.n) return;

  const [[cols]] = await pool.query("SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'field_customers' AND COLUMN_NAME IN ('name','contact_person','phone','address','area','kind')");
  if (cols.n < 6) { console.error('[field] sales seed skipped: field_customers has no standard columns yet'); return; }

  const cust = {};
  for (const [name, contact, phone, area, address, credit] of CUSTOMERS) {
    let [[c]] = await pool.query('SELECT id FROM field_customers WHERE name = ? LIMIT 1', [name]);
    if (!c) {
      const [r] = await pool.query('INSERT INTO field_customers (name, contact_person, phone, address, area, kind) VALUES (?,?,?,?,?,?)', [name, contact, phone, address, area, 'Active']);
      c = { id: r.insertId };
    }
    cust[name] = c.id;
    await pool.query('INSERT IGNORE INTO field_customer_credit (customer_id, credit_limit) VALUES (?,?)', [c.id, credit]);
  }

  const [[rm]] = await pool.query("SELECT id FROM staff WHERE email = 'rm@artradeinternational.com'");
  const [[any]] = await pool.query("SELECT id FROM staff WHERE status = 'Active' ORDER BY id LIMIT 1");
  const owner = rm?.id || any.id;
  const staffByName = {};
  const [staff] = await pool.query('SELECT id, name FROM staff');
  staff.forEach(s => { staffByName[s.name] = s.id; });

  // open invoices
  for (const [name, list] of INVOICES) {
    for (const [id, ref, total, paid, age] of list) {
      await pool.query('INSERT IGNORE INTO field_invoices (id, order_ref, customer_id, total, paid, due_date, created_at) VALUES (?,?,?,?,?, DATE_ADD(DATE(UTC_TIMESTAMP() - INTERVAL ? DAY), INTERVAL 30 DAY), UTC_TIMESTAMP() - INTERVAL ? DAY)',
        [id, ref, cust[name], total, paid, age, age]);
    }
  }

  // orders + deliveries
  const [prods] = await pool.query('SELECT id, name, sku, price FROM products WHERE active = 1 AND price BETWEEN 3000 AND 12000 AND stock >= 20 AND name LIKE "%(%" ORDER BY popular DESC, id LIMIT 40');
  let pi = 0;
  let inv = 2115;
  for (const [orderId, dn, name, n, status, when] of DELIVERIES) {
    const lines = [];
    for (let i = 0; i < n; i++) { const p = prods[pi++ % prods.length]; lines.push([p, 1 + (i % 3)]); }
    const subtotal = lines.reduce((t, [p, q]) => t + p.price * q, 0);
    const discount = Math.round(subtotal * 0.05);
    await pool.query('INSERT INTO field_sales_orders (id, customer_id, staff_id, status, subtotal, discount, total, accounting_synced, approval_status, created_at) VALUES (?,?,?,?,?,?,?,1,?, UTC_TIMESTAMP() - INTERVAL 1 DAY)',
      [orderId, cust[name], owner, status === 'Delivered' ? 'Delivered' : 'Placed', subtotal, discount, subtotal - discount, 'Approved']);
    for (const [p, q] of lines) {
      await pool.query('INSERT INTO field_sales_order_items (order_id, product_id, name, sku, price, qty) VALUES (?,?,?,?,?,?)', [orderId, p.id, p.name, p.sku || (/\(([^)]+)\)/.exec(p.name) || [])[1] || '', p.price, q]);
    }
    const addr = CUSTOMERS.find(c => c[0] === name)[4];
    let invoiceId = null;
    if (status === 'Delivered') {
      invoiceId = 'INV-' + (++inv);
      await pool.query('INSERT INTO field_invoices (id, order_id, order_ref, customer_id, total, paid, due_date, created_at) VALUES (?,?,?,?,?,0, DATE_ADD(UTC_DATE(), INTERVAL 30 DAY), UTC_TIMESTAMP())', [invoiceId, orderId, orderId, cust[name], subtotal - discount]);
    }
    const delivered = status === 'Delivered';
    // the design times are Bangladesh time (UTC+6)
    let at = null;
    if (delivered) {
      const m = /(\d+):(\d+) (AM|PM)/.exec(when);
      const h = (Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0);
      at = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), h - 6, Number(m[2]))).toISOString().slice(0, 19).replace('T', ' ');
    }
    await pool.query('INSERT INTO field_deliveries (id, order_id, status, eta, address, received_by, delivered_at, otp_ok, invoice_id, staff_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [dn, orderId, status, delivered ? '' : when, addr, delivered ? 'Mr. Kamal, IT dept.' : '', at, delivered ? 1 : 0, invoiceId, owner]);
  }

  // money receipts
  for (const [days, name, mr, refs, who, amount, method, status] of RECEIPTS) {
    const firstInv = /INV-\d+/.exec(refs)?.[0] || null;
    const [r] = await pool.query('INSERT IGNORE INTO field_payments (id, invoice_id, invoice_refs, customer_id, staff_id, method, amount, status, created_at) VALUES (?,?,?,?,?,?,?,?, UTC_TIMESTAMP() - INTERVAL ? DAY)',
      [mr, firstInv, refs, cust[name], staffByName[who] || owner, method, amount, status, days]);
    if (r.affectedRows && firstInv) await pool.query('INSERT INTO field_payment_items (payment_id, invoice_id, amount) VALUES (?,?,?)', [mr, firstInv, amount]);
  }
}
