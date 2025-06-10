-- migrate:up
CREATE TABLE IF NOT EXISTS stripe_subscription_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL,
  stripe_item_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_price_id VARCHAR(255) NOT NULL,
  stripe_product_id VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_amount INT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES stripe_subscriptions(id) ON DELETE CASCADE,
  INDEX (stripe_price_id),
  INDEX (stripe_product_id)
);

-- migrate:down
DROP TABLE IF EXISTS stripe_subscription_items;
