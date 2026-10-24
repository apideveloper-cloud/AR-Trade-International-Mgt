-- Purchase requisitions, vendor quotes and purchase orders (module: purchase). Idempotent.
CREATE TABLE IF NOT EXISTS field_purchase_requests (
  id VARCHAR(20) PRIMARY KEY,
  product_id INT NULL,
  product_name VARCHAR(255) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  need_by DATE NULL,
  stock_now INT NOT NULL DEFAULT 0,
  stock_min INT NOT NULL DEFAULT 0,
  requested_by VARCHAR(120) NOT NULL DEFAULT '',
  staff_id INT NULL,
  status ENUM('Open','Ordered','Closed') NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_status (status, created_at)
);

CREATE TABLE IF NOT EXISTS field_vendor_quotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pr_id VARCHAR(20) NOT NULL,
  vendor_id INT NOT NULL,
  unit_price INT NOT NULL DEFAULT 0,
  delivery_days INT NOT NULL DEFAULT 3,
  rating DECIMAL(2,1) NOT NULL DEFAULT 4.0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pr_vendor (pr_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS field_purchase_orders (
  id VARCHAR(20) PRIMARY KEY,
  pr_id VARCHAR(20) NULL,
  vendor_id INT NOT NULL,
  staff_id INT NOT NULL,
  status ENUM('Draft','Submitted','ManagerApproved','Approved','Rejected') NOT NULL DEFAULT 'Draft',
  subtotal INT NOT NULL DEFAULT 0,
  vat INT NOT NULL DEFAULT 0,
  freight INT NOT NULL DEFAULT 0,
  grand_total INT NOT NULL DEFAULT 0,
  deliver_by DATE NULL,
  payment_terms VARCHAR(30) NOT NULL DEFAULT '15 days',
  deliver_to VARCHAR(80) NOT NULL DEFAULT 'Head office · Santinagar',
  note VARCHAR(255) NOT NULL DEFAULT '',
  rev INT NOT NULL DEFAULT 0,
  manager_by INT NULL,
  manager_remarks VARCHAR(255) NOT NULL DEFAULT '',
  manager_at DATETIME NULL,
  final_by INT NULL,
  final_remarks VARCHAR(255) NOT NULL DEFAULT '',
  final_at DATETIME NULL,
  rejected_by INT NULL,
  reject_remarks VARCHAR(255) NOT NULL DEFAULT '',
  rejected_at DATETIME NULL,
  vendor_mailed TINYINT(1) NOT NULL DEFAULT 0,
  submitted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff (staff_id, created_at),
  KEY idx_status (status, created_at)
);

CREATE TABLE IF NOT EXISTS field_purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id VARCHAR(20) NOT NULL,
  product_id INT NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(80) NOT NULL DEFAULT '',
  qty INT NOT NULL DEFAULT 1,
  unit_price INT NOT NULL DEFAULT 0,
  KEY idx_po (po_id)
);
