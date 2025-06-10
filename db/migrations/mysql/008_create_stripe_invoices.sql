-- migrate:up
CREATE TABLE IF NOT EXISTS stripe_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  stripe_invoice_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_subscription_id VARCHAR(255) NULL,
  amount_total INT NOT NULL,
  amount_paid INT NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status VARCHAR(50) NOT NULL,
  invoice_pdf TEXT NULL,
  hosted_invoice_url TEXT NULL,
  payment_intent_id VARCHAR(255) NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  due_date TIMESTAMP NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (stripe_subscription_id),
  INDEX (status),
  INDEX (period_end),
  INDEX (due_date),
  INDEX (user_id, status)
);

-- migrate:down
DROP TABLE IF EXISTS stripe_invoices;
