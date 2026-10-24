-- Leave requests of the field app (module: leave). Dates are plain BD calendar dates.
CREATE TABLE IF NOT EXISTS field_leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  type ENUM('Casual','Sick','Annual','Unpaid') NOT NULL DEFAULT 'Casual',
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days SMALLINT NOT NULL DEFAULT 1,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  status ENUM('Open','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Open',
  remarks VARCHAR(255) NOT NULL DEFAULT '',
  decided_by INT NULL,
  decided_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff (staff_id, from_date),
  KEY idx_status (status, from_date)
);
