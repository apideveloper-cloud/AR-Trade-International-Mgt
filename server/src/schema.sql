CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(40) PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  hidden TINYINT(1) NOT NULL DEFAULT 0,
  img VARCHAR(500) NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY,
  category_id VARCHAR(40) NOT NULL,
  brand VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  old_price INT NOT NULL DEFAULT 0,
  price INT NOT NULL DEFAULT 0,
  img VARCHAR(500) NULL,
  stock INT NOT NULL DEFAULT 0,
  popular TINYINT(1) NOT NULL DEFAULT 0,
  is_new TINYINT(1) NOT NULL DEFAULT 0,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  tech VARCHAR(80) NOT NULL DEFAULT '',
  color VARCHAR(80) NOT NULL DEFAULT '',
  yield_info VARCHAR(160) NOT NULL DEFAULT '',
  part VARCHAR(80) NOT NULL DEFAULT '',
  compat TEXT NULL,
  spec VARCHAR(255) NOT NULL DEFAULT '',
  extra JSON NULL,
  gallery JSON NULL,
  description MEDIUMTEXT NULL,
  short_desc TEXT NULL,
  sku VARCHAR(80) NOT NULL DEFAULT '',
  tags JSON NULL,
  meta_title VARCHAR(160) NOT NULL DEFAULT '',
  meta_desc VARCHAR(320) NOT NULL DEFAULT '',
  meta_keywords VARCHAR(500) NOT NULL DEFAULT '',
  source_url VARCHAR(500) NOT NULL DEFAULT '',
  edited TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_cat (category_id),
  KEY idx_brand (brand),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  password_hash VARCHAR(100) NOT NULL,
  address VARCHAR(255) NOT NULL DEFAULT '',
  area ENUM('inside','suburb','outside') NOT NULL DEFAULT 'inside',
  role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  profile JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_phone (phone)
);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(20) PRIMARY KEY,
  user_id INT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  customer_email VARCHAR(160) NOT NULL DEFAULT '',
  company VARCHAR(160) NOT NULL DEFAULT '',
  bin VARCHAR(40) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL,
  area ENUM('inside','suburb','outside') NOT NULL DEFAULT 'inside',
  subtotal INT NOT NULL,
  discount INT NOT NULL DEFAULT 0,
  member_discount INT NOT NULL DEFAULT 0,
  delivery INT NOT NULL DEFAULT 0,
  express TINYINT(1) NOT NULL DEFAULT 0,
  total INT NOT NULL,
  vat INT NOT NULL DEFAULT 0,
  payment VARCHAR(40) NOT NULL DEFAULT 'Cash on delivery',
  gateway VARCHAR(40) NOT NULL DEFAULT '',
  pay_status ENUM('Unpaid','Paid') NOT NULL DEFAULT 'Unpaid',
  status ENUM('Pending','Confirmed','Packed','Shipped','Delivered','Cancelled') NOT NULL DEFAULT 'Pending',
  partial ENUM('split','together','drop') NOT NULL DEFAULT 'split',
  slot VARCHAR(80) NOT NULL DEFAULT '',
  vat_invoice TINYINT(1) NOT NULL DEFAULT 0,
  hold TINYINT(1) NOT NULL DEFAULT 0,
  hold_note VARCHAR(255) NOT NULL DEFAULT '',
  note VARCHAR(500) NOT NULL DEFAULT '',
  coupon VARCHAR(40) NOT NULL DEFAULT '',
  flow ENUM('Placed','Verification','Confirmed','Packed','Out for delivery','Delivered','Cancelled','Returned') NOT NULL DEFAULT 'Placed',
  branch_id VARCHAR(4) NULL,
  rider_id INT NULL,
  courier VARCHAR(20) NULL,
  courier_tn VARCHAR(30) NULL,
  otp VARCHAR(8) NULL,
  out_at DATETIME NULL,
  attempts JSON NULL,
  pod JSON NULL,
  cod_collected INT NOT NULL DEFAULT 0,
  cod_deposited_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  KEY idx_phone (customer_phone)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(20) NOT NULL,
  product_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  img VARCHAR(500) NULL,
  price INT NOT NULL,
  qty INT NOT NULL,
  backorder INT NOT NULL DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  flow VARCHAR(20) NULL,
  note VARCHAR(255) NOT NULL DEFAULT '',
  at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(4) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  area VARCHAR(120) NOT NULL DEFAULT '',
  area_keys JSON NULL
);

CREATE TABLE IF NOT EXISTS order_returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(20) NOT NULL UNIQUE,
  reason VARCHAR(120) NOT NULL,
  note VARCHAR(500) NOT NULL DEFAULT '',
  status ENUM('Requested','Approved','Rejected') NOT NULL DEFAULT 'Requested',
  mode ENUM('Refund','Replacement') NULL,
  refund INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  done_at TIMESTAMP NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_requests (
  id VARCHAR(20) PRIMARY KEY,
  type VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  model VARCHAR(160) NOT NULL DEFAULT '',
  issue VARCHAR(500) NOT NULL DEFAULT '',
  preferred_date DATE NULL,
  status ENUM('New','Scheduled','In progress','Completed') NOT NULL DEFAULT 'New',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  contact VARCHAR(160) NOT NULL DEFAULT '',
  company VARCHAR(160) NOT NULL DEFAULT '',
  subject VARCHAR(160) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscribers (
  email VARCHAR(160) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(160) NOT NULL,
  source VARCHAR(120) NOT NULL DEFAULT '',
  token VARCHAR(40) NOT NULL UNIQUE,
  status ENUM('Pending','Confirmed','Unsubscribed') NOT NULL DEFAULT 'Pending',
  ip VARCHAR(60) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP NULL,
  KEY idx_email (email)
);

CREATE TABLE IF NOT EXISTS jobs (
  id VARCHAR(20) PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  dept VARCHAR(60) NOT NULL,
  type VARCHAR(40) NOT NULL,
  loc VARCHAR(120) NOT NULL,
  exp VARCHAR(60) NOT NULL DEFAULT '',
  salary VARCHAR(80) NOT NULL DEFAULT '',
  vacancies INT NOT NULL DEFAULT 1,
  deadline DATETIME NOT NULL,
  open TINYINT(1) NOT NULL DEFAULT 1,
  about TEXT NULL,
  resp JSON NULL,
  req JSON NULL,
  perks JSON NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(20) PRIMARY KEY,
  job_id VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(160) NOT NULL DEFAULT '',
  exp VARCHAR(60) NOT NULL DEFAULT '',
  salary VARCHAR(40) NOT NULL DEFAULT '',
  link VARCHAR(255) NOT NULL DEFAULT '',
  note TEXT NULL,
  cv_name VARCHAR(255) NOT NULL DEFAULT '',
  cv_file VARCHAR(255) NOT NULL DEFAULT '',
  stage ENUM('New','Shortlisted','Interview','Offered','Hired','Rejected') NOT NULL DEFAULT 'New',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS counters (
  name VARCHAR(30) PRIMARY KEY,
  v BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_hits (
  k VARCHAR(120) PRIMARY KEY,
  n INT NOT NULL,
  reset_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(60) PRIMARY KEY,
  v JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'Delivery rider',
  nid VARCHAR(20) NOT NULL DEFAULT '',
  present_address VARCHAR(300) NOT NULL DEFAULT '',
  contact_address VARCHAR(300) NOT NULL DEFAULT '',
  ref_name VARCHAR(120) NOT NULL DEFAULT '',
  ref_phone VARCHAR(20) NOT NULL DEFAULT '',
  status ENUM('Active','Pending','Disabled') NOT NULL DEFAULT 'Pending',
  vehicle VARCHAR(80) NOT NULL DEFAULT '',
  rating DECIMAL(2,1) NOT NULL DEFAULT 4.8,
  branch_id VARCHAR(4) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_phone (phone)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject VARCHAR(200) NOT NULL,
  audience VARCHAR(60) NOT NULL,
  body TEXT NULL,
  sent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(40) NOT NULL DEFAULT 'Home',
  district VARCHAR(60) NOT NULL DEFAULT 'Dhaka',
  thana VARCHAR(80) NOT NULL DEFAULT '',
  area VARCHAR(80) NOT NULL DEFAULT '',
  line VARCHAR(255) NOT NULL,
  lat DECIMAL(9,6) NULL,
  lng DECIMAL(9,6) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_user (user_id)
);

CREATE TABLE IF NOT EXISTS user_family (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  relation VARCHAR(40) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  KEY idx_user (user_id)
);

CREATE TABLE IF NOT EXISTS user_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  every_days INT NOT NULL DEFAULT 30,
  next_at DATE NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  KEY idx_user (user_id)
);

CREATE TABLE IF NOT EXISTS mkt_templates (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  kind VARCHAR(30) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  preheader VARCHAR(200) NOT NULL DEFAULT '',
  headline VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  cta VARCHAR(60) NOT NULL DEFAULT 'Shop now',
  hero VARCHAR(255) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mkt_automations (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  trigger_text VARCHAR(200) NOT NULL,
  steps JSON NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sent INT NOT NULL DEFAULT 0,
  opens INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  unsubs INT NOT NULL DEFAULT 0,
  revenue INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mkt_campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  tag VARCHAR(30) NOT NULL DEFAULT 'Offer',
  template_id VARCHAR(30) NULL,
  subj_a VARCHAR(200) NOT NULL,
  subj_b VARCHAR(200) NOT NULL DEFAULT '',
  body TEXT NULL,
  audience VARCHAR(20) NOT NULL DEFAULT 'offers',
  status ENUM('Scheduled','Sent') NOT NULL DEFAULT 'Scheduled',
  send_at DATETIME NOT NULL,
  sent INT NOT NULL DEFAULT 0,
  opens INT NULL,
  clicks INT NULL,
  unsubs INT NOT NULL DEFAULT 0,
  revenue INT NULL,
  ab_a TINYINT NULL,
  ab_b TINYINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_prefs (
  email VARCHAR(160) PRIMARY KEY,
  offers TINYINT(1) NOT NULL DEFAULT 1,
  festivals TINYINT(1) NOT NULL DEFAULT 1,
  tips TINYINT(1) NOT NULL DEFAULT 1,
  refill TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mkt_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(160) NOT NULL,
  what VARCHAR(255) NOT NULL,
  at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_outbox (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(160) NOT NULL,
  automation_id VARCHAR(30) NOT NULL,
  step_label VARCHAR(40) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  send_at DATETIME NOT NULL,
  status ENUM('Queued','Sent','Skipped') NOT NULL DEFAULT 'Queued',
  KEY idx_auto (automation_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NULL,
  name VARCHAR(120) NOT NULL,
  rating TINYINT NOT NULL,
  title VARCHAR(120) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  KEY idx_prod (product_id, status),
  KEY idx_status (status)
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(190) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'Articles',
  cover VARCHAR(500) NOT NULL DEFAULT '',
  excerpt VARCHAR(400) NOT NULL DEFAULT '',
  body MEDIUMTEXT NOT NULL,
  published DATE NOT NULL,
  source_url VARCHAR(500) NOT NULL DEFAULT '',
  status ENUM('Published','Draft') NOT NULL DEFAULT 'Published',
  author VARCHAR(120) NOT NULL DEFAULT 'AR Trade International',
  author_id INT NULL,
  edited TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  KEY idx_pub (status, published)
);

CREATE TABLE IF NOT EXISTS field_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  type ENUM('Clocked In','Clocked Out') NOT NULL,
  at DATETIME NOT NULL,
  lat DECIMAL(9,6) NULL,
  lng DECIMAL(9,6) NULL,
  KEY idx_staff_at (staff_id, at)
);

CREATE TABLE IF NOT EXISTS field_track (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  at DATETIME NOT NULL,
  KEY idx_staff_at (staff_id, at)
);

CREATE TABLE IF NOT EXISTS field_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  title VARCHAR(160) NOT NULL,
  category VARCHAR(60) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  voucher VARCHAR(80) NULL,
  status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  decided_by INT NULL,
  decided_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff (staff_id),
  KEY idx_status (status)
);

CREATE TABLE IF NOT EXISTS site_pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  grp ENUM('servicing','clients','company') NOT NULL,
  title VARCHAR(200) NOT NULL,
  excerpt VARCHAR(400) NOT NULL DEFAULT '',
  body MEDIUMTEXT NOT NULL,
  cover VARCHAR(500) NOT NULL DEFAULT '',
  images JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('Published','Draft') NOT NULL DEFAULT 'Published',
  edited TINYINT(1) NOT NULL DEFAULT 0,
  source_url VARCHAR(500) NOT NULL DEFAULT '',
  updated_at TIMESTAMP NULL DEFAULT NULL,
  KEY idx_grp (grp, status, sort_order)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  requested TINYINT(1) NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  KEY idx_pending (requested, used_at, expires_at)
);

CREATE TABLE IF NOT EXISTS product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  position TINYINT NOT NULL DEFAULT 0,
  src_url VARCHAR(500) NOT NULL DEFAULT '',
  path VARCHAR(500) NOT NULL,
  alt VARCHAR(255) NOT NULL DEFAULT '',
  width INT NOT NULL DEFAULT 0,
  height INT NOT NULL DEFAULT 0,
  KEY idx_product (product_id, position)
);

CREATE TABLE IF NOT EXISTS product_specs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  position TINYINT NOT NULL DEFAULT 0,
  name VARCHAR(80) NOT NULL,
  value VARCHAR(500) NOT NULL,
  KEY idx_product (product_id, position)
);
