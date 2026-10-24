-- Admin console, reports targets (modules: admin, reports, overview, users).
-- field_automation: the three switches on the app's Admin console. They record the admin's choice; the web console jobs read them.
CREATE TABLE IF NOT EXISTS field_automation (
  k VARCHAR(30) PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_by VARCHAR(120) NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO field_automation (k) VALUES ('accounting'), ('seo'), ('mail_feedback');

-- targets that the report "target ring" is measured against
CREATE TABLE IF NOT EXISTS field_settings (
  k VARCHAR(40) PRIMARY KEY,
  v VARCHAR(255) NOT NULL
);

INSERT IGNORE INTO field_settings (k, v) VALUES ('target_sales_month', '500000'), ('target_attendance_pct', '95'), ('budget_expense_month', '60000');
