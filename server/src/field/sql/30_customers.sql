-- Customers & visits (RM) module: customers, visits, follow-ups
CREATE TABLE IF NOT EXISTS field_customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  contact_person VARCHAR(120) NOT NULL DEFAULT '',
  contact_role VARCHAR(80) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  email VARCHAR(160) NOT NULL DEFAULT '',
  address VARCHAR(300) NOT NULL DEFAULT '',
  area VARCHAR(80) NOT NULL DEFAULT '',
  kind ENUM('Active','Upcoming','Inactive') NOT NULL DEFAULT 'Upcoming',
  customer_type VARCHAR(40) NOT NULL DEFAULT '',
  interest VARCHAR(160) NOT NULL DEFAULT '',
  monthly_value VARCHAR(40) NOT NULL DEFAULT '',
  lead_source VARCHAR(60) NOT NULL DEFAULT '',
  next_step VARCHAR(80) NOT NULL DEFAULT '',
  note TEXT NULL,
  lat DECIMAL(9,6) NULL,
  lng DECIMAL(9,6) NULL,
  owner_staff_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_kind (kind),
  KEY idx_name (name)
);

CREATE TABLE IF NOT EXISTS field_visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  staff_id INT NOT NULL,
  visit_date DATE NOT NULL,
  visit_time TIME NOT NULL DEFAULT '10:00:00',
  purpose VARCHAR(60) NOT NULL DEFAULT '',
  status ENUM('Planned','InProgress','Done') NOT NULL DEFAULT 'Planned',
  check_in DATETIME NULL,
  check_out DATETIME NULL,
  outcome VARCHAR(40) NOT NULL DEFAULT '',
  order_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  followup_action VARCHAR(40) NOT NULL DEFAULT '',
  followup_when VARCHAR(40) NOT NULL DEFAULT '',
  lat DECIMAL(9,6) NULL,
  lng DECIMAL(9,6) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff_date (staff_id, visit_date),
  KEY idx_customer (customer_id)
);

CREATE TABLE IF NOT EXISTS field_followups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  visit_id INT NULL,
  staff_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  note TEXT NULL,
  action VARCHAR(40) NOT NULL DEFAULT 'Call',
  due_at DATETIME NOT NULL,
  status ENUM('Open','Done') NOT NULL DEFAULT 'Open',
  done_remarks VARCHAR(255) NOT NULL DEFAULT '',
  rescheduled_from DATETIME NULL,
  history_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff_due (staff_id, due_at),
  KEY idx_customer (customer_id)
);

CREATE TABLE IF NOT EXISTS field_visit_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  visit_id INT NOT NULL,
  file VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_visit (visit_id)
);
