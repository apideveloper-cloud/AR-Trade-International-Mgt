import { pool } from '../db.js';

/** Creates the quotation tables and adds the columns older databases are missing. */
export async function ensureQuotes() {
  const q = sql => pool.query(sql);
  await q(`CREATE TABLE IF NOT EXISTS quotations (id VARCHAR(24) PRIMARY KEY, quote_date DATE NOT NULL, to_name VARCHAR(200) NOT NULL, address VARCHAR(300) NOT NULL DEFAULT '', attend VARCHAR(120) NOT NULL DEFAULT '', desig VARCHAR(120) NOT NULL DEFAULT '', mobile VARCHAR(40) NOT NULL DEFAULT '', email VARCHAR(160) NOT NULL DEFAULT '',
    subject VARCHAR(300) NOT NULL DEFAULT '', intro TEXT NULL, notes TEXT NULL, valid_days INT NOT NULL DEFAULT 3, status VARCHAR(12) NOT NULL DEFAULT 'Draft',
    install_charge INT NOT NULL DEFAULT 0, transport_charge INT NOT NULL DEFAULT 0, discount INT NOT NULL DEFAULT 0, vat INT NOT NULL DEFAULT 0, total INT NOT NULL DEFAULT 0, net INT NOT NULL DEFAULT 0,
    signer_name VARCHAR(120) NOT NULL DEFAULT '', signer_desig VARCHAR(120) NOT NULL DEFAULT '', signer_dept VARCHAR(120) NOT NULL DEFAULT '', signer_cell VARCHAR(80) NOT NULL DEFAULT '',
    staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, KEY idx_date (quote_date), KEY idx_status (status))`);
  const [qc] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations'");
  const have = new Set(qc.map(r => r.c));
  for (const [c, def] of [['cust_type', "VARCHAR(10) NOT NULL DEFAULT 'New'"], ['customer_id', 'INT NULL'], ['share_token', 'VARCHAR(48) NULL']]) if (!have.has(c)) await pool.query(`ALTER TABLE quotations ADD COLUMN ${c} ${def}`);
  await q(`CREATE TABLE IF NOT EXISTS quotation_items (id INT AUTO_INCREMENT PRIMARY KEY, quote_id VARCHAR(24) NOT NULL, sl INT NOT NULL DEFAULT 1, product_id INT NULL, description VARCHAR(400) NOT NULL, qty INT NOT NULL DEFAULT 1, unit VARCHAR(12) NOT NULL DEFAULT 'PCS', warranty VARCHAR(60) NOT NULL DEFAULT '', unit_price INT NOT NULL DEFAULT 0, KEY idx_quote (quote_id))`);
}
