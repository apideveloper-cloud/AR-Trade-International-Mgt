-- Sales & collection module (orders, deliveries, invoices, money receipts).
-- Products are read from the web shop's `products` table; customers live in field_customers (module "customers").
-- Compatible minimal customers table: created only if the customers module has not created its own yet.
CREATE TABLE IF NOT EXISTS field_customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  contact_person VARCHAR(120) NOT NULL DEFAULT '',
  contact_role VARCHAR(80) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  email VARCHAR(160) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  area VARCHAR(80) NOT NULL DEFAULT '',
  kind VARCHAR(20) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS field_customer_credit (
  customer_id INT PRIMARY KEY,
  credit_limit INT NOT NULL DEFAULT 300000
);

CREATE TABLE IF NOT EXISTS field_sales_orders (
  id VARCHAR(20) PRIMARY KEY,
  customer_id INT NOT NULL,
  staff_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Placed',
  subtotal INT NOT NULL DEFAULT 0,
  discount INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  notes VARCHAR(255) NOT NULL DEFAULT '',
  accounting_synced TINYINT(1) NOT NULL DEFAULT 0,
  approval_status VARCHAR(12) NOT NULL DEFAULT 'Pending',
  approved_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff (staff_id),
  KEY idx_customer (customer_id)
);

CREATE TABLE IF NOT EXISTS field_sales_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(20) NOT NULL,
  product_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(80) NOT NULL DEFAULT '',
  price INT NOT NULL DEFAULT 0,
  qty INT NOT NULL DEFAULT 1,
  KEY idx_order (order_id)
);

CREATE TABLE IF NOT EXISTS field_invoices (
  id VARCHAR(20) PRIMARY KEY,
  order_id VARCHAR(20) NULL,
  order_ref VARCHAR(30) NOT NULL DEFAULT '',
  customer_id INT NOT NULL,
  total INT NOT NULL DEFAULT 0,
  paid INT NOT NULL DEFAULT 0,
  due_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customer (customer_id)
);

CREATE TABLE IF NOT EXISTS field_deliveries (
  id VARCHAR(20) PRIMARY KEY,
  order_id VARCHAR(20) NOT NULL,
  status ENUM('Ready','OnTheWay','Delivered') NOT NULL DEFAULT 'Ready',
  eta VARCHAR(30) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  received_by VARCHAR(120) NOT NULL DEFAULT '',
  delivered_at DATETIME NULL,
  lat DECIMAL(9,6) NULL,
  lng DECIMAL(9,6) NULL,
  proof_photo VARCHAR(80) NULL,
  signature VARCHAR(80) NULL,
  otp_ok TINYINT(1) NOT NULL DEFAULT 0,
  otp_hash CHAR(64) NULL,
  invoice_id VARCHAR(20) NULL,
  staff_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order (order_id)
);

CREATE TABLE IF NOT EXISTS field_payments (
  id VARCHAR(20) PRIMARY KEY,
  invoice_id VARCHAR(20) NULL,
  invoice_refs VARCHAR(255) NOT NULL DEFAULT '',
  customer_id INT NOT NULL,
  staff_id INT NOT NULL,
  method ENUM('Cash','bKash','Cheque','Bank') NOT NULL DEFAULT 'Cash',
  amount INT NOT NULL DEFAULT 0,
  reference VARCHAR(80) NOT NULL DEFAULT '',
  status ENUM('Received','ChequePending','Bounced') NOT NULL DEFAULT 'Received',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customer (customer_id),
  KEY idx_staff (staff_id)
);

CREATE TABLE IF NOT EXISTS field_payment_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id VARCHAR(20) NOT NULL,
  invoice_id VARCHAR(20) NOT NULL,
  amount INT NOT NULL DEFAULT 0,
  KEY idx_payment (payment_id),
  KEY idx_invoice (invoice_id)
);
