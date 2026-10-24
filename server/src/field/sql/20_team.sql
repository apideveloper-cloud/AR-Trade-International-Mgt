-- Team map, contacts and calls (module A2). Idempotent.
CREATE TABLE IF NOT EXISTS field_vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  kind VARCHAR(60) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  email VARCHAR(160) NOT NULL DEFAULT '',
  address VARCHAR(300) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vendor_name (name)
);

CREATE TABLE IF NOT EXISTS field_chat (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_staff INT NOT NULL,
  to_staff INT NOT NULL,
  body VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL DEFAULT NULL,
  KEY idx_pair (from_staff, to_staff, id),
  KEY idx_to (to_staff, read_at)
);

CREATE TABLE IF NOT EXISTS field_call_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  peer_name VARCHAR(160) NOT NULL,
  peer_phone VARCHAR(30) NOT NULL DEFAULT '',
  via VARCHAR(12) NOT NULL DEFAULT 'gsm',
  direction VARCHAR(8) NOT NULL DEFAULT 'out',
  seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff (staff_id, id)
);
