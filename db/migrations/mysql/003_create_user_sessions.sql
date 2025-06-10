-- migrate:up
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  refresh_token VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  device_type VARCHAR(64),
  browser VARCHAR(64),
  os VARCHAR(64),
  ip_address VARCHAR(45),
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (user_id),
  INDEX (expires_at),
  INDEX (is_revoked)
);

-- migrate:down
DROP TABLE IF EXISTS user_sessions;
