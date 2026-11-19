// Creates / upgrades the inventory tables (safe to run on every start).
import { pool } from '../db.js';
import { fillVendorCodes } from './numbering.js';

/** Adds any of the given [column, definition] pairs that the table does not have yet. */
async function addCols(table, cols) {
  const [cc] = await pool.query('SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]);
  const have = new Set(cc.map(r => r.c));
  for (const [c, def] of cols) if (!have.has(c)) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${c} ${def}`);
}

/** Vendors table, its later columns, vendor codes and the unique code index. */
async function ensureVendors() {
  await pool.query(`CREATE TABLE IF NOT EXISTS field_vendors (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(160) NOT NULL, kind VARCHAR(60) NOT NULL DEFAULT '', phone VARCHAR(30) NOT NULL DEFAULT '', email VARCHAR(160) NOT NULL DEFAULT '', address VARCHAR(300) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_vendor_name (name))`);
  await addCols('field_vendors', [['contact', "VARCHAR(120) NOT NULL DEFAULT ''"], ['opening', 'INT NOT NULL DEFAULT 0'], ['active', 'TINYINT(1) NOT NULL DEFAULT 1'], ['note', "VARCHAR(300) NOT NULL DEFAULT ''"], ['code', 'VARCHAR(20) NULL'], ['pic_desig', "VARCHAR(80) NOT NULL DEFAULT ''"], ['pic_phone', "VARCHAR(30) NOT NULL DEFAULT ''"], ['vtype', "VARCHAR(10) NOT NULL DEFAULT 'Local'"]]);
  await fillVendorCodes();
  const [ix] = await pool.query("SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'field_vendors' AND INDEX_NAME = 'uq_vendor_code' LIMIT 1");
  if (!ix.length) await pool.query('ALTER TABLE field_vendors ADD UNIQUE KEY uq_vendor_code (code)');
}

/** Creates every inventory table and adds columns introduced later. */
export async function ensureInventory() {
  await ensureVendors();
  const q = s => pool.query(s);
  await q(`CREATE TABLE IF NOT EXISTS stock_receipts (id VARCHAR(20) PRIMARY KEY, vendor_id INT NOT NULL, po_id VARCHAR(20) NULL, invoice_no VARCHAR(60) NOT NULL DEFAULT '', received_on DATE NOT NULL, note VARCHAR(300) NOT NULL DEFAULT '', total INT NOT NULL DEFAULT 0, staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_vendor (vendor_id, received_on), KEY idx_po (po_id))`);
  await q(`CREATE TABLE IF NOT EXISTS stock_receipt_items (id INT AUTO_INCREMENT PRIMARY KEY, receipt_id VARCHAR(20) NOT NULL, product_id INT NOT NULL, name VARCHAR(255) NOT NULL, qty INT NOT NULL, unit_cost INT NOT NULL DEFAULT 0, KEY idx_receipt (receipt_id))`);
  // The purchase workflow was added later: purchases that already exist were received straight into stock, so they count as Stocked.
  await addCols('stock_receipts', [['status', "VARCHAR(12) NOT NULL DEFAULT 'Stocked'"], ['decided_by', "VARCHAR(120) NOT NULL DEFAULT ''"], ['decided_at', 'TIMESTAMP NULL'], ['decision_note', "VARCHAR(300) NOT NULL DEFAULT ''"], ['stocked_by', "VARCHAR(120) NOT NULL DEFAULT ''"], ['stocked_at', 'TIMESTAMP NULL']]);
  await addCols('stock_receipt_items', [['sale_price', 'INT NULL'], ['remarks', "VARCHAR(200) NOT NULL DEFAULT ''"], ['discount', 'INT NOT NULL DEFAULT 0']]);
  await addCols('stock_receipts', [['reference_no', "VARCHAR(60) NOT NULL DEFAULT ''"]]);
  await q(`CREATE TABLE IF NOT EXISTS stock_moves (id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL, kind VARCHAR(20) NOT NULL, qty INT NOT NULL, unit_cost INT NULL, balance INT NOT NULL DEFAULT 0, ref VARCHAR(30) NOT NULL DEFAULT '', note VARCHAR(300) NOT NULL DEFAULT '', staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_product (product_id, id))`);
  await q(`CREATE TABLE IF NOT EXISTS stock_damages (id VARCHAR(20) PRIMARY KEY, product_id INT NOT NULL, name VARCHAR(255) NOT NULL, qty INT NOT NULL, unit_cost INT NOT NULL DEFAULT 0, reason VARCHAR(300) NOT NULL DEFAULT '', vendor_id INT NULL, damaged_on DATE NOT NULL, staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_date (damaged_on))`);
  await q(`CREATE TABLE IF NOT EXISTS vendor_returns (id VARCHAR(20) PRIMARY KEY, vendor_id INT NOT NULL, receipt_id VARCHAR(20) NULL, returned_on DATE NOT NULL, reason VARCHAR(300) NOT NULL DEFAULT '', total INT NOT NULL DEFAULT 0, staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_vendor (vendor_id, returned_on))`);
  await q(`CREATE TABLE IF NOT EXISTS vendor_return_items (id INT AUTO_INCREMENT PRIMARY KEY, return_id VARCHAR(20) NOT NULL, product_id INT NOT NULL, name VARCHAR(255) NOT NULL, qty INT NOT NULL, unit_cost INT NOT NULL DEFAULT 0, KEY idx_return (return_id))`);
  await q(`CREATE TABLE IF NOT EXISTS vendor_payments (id VARCHAR(20) PRIMARY KEY, vendor_id INT NOT NULL, receipt_id VARCHAR(20) NULL, amount INT NOT NULL, method VARCHAR(20) NOT NULL DEFAULT 'Cash', reference VARCHAR(80) NOT NULL DEFAULT '', paid_on DATE NOT NULL, note VARCHAR(300) NOT NULL DEFAULT '', staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_vendor (vendor_id, paid_on), KEY idx_receipt (receipt_id))`);
}
