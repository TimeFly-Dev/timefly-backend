-- migrate:up
CREATE TABLE IF NOT EXISTS stripe_payment_methods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'card',
  card_brand VARCHAR(20) NULL,
  card_last4 VARCHAR(4) NULL,
  card_exp_month INT NULL,
  card_exp_year INT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (stripe_customer_id),
  INDEX (is_default)
);

-- migrate:down
DROP TABLE IF EXISTS stripe_payment_methods;
