-- migrate:up
CREATE TABLE IF NOT EXISTS stripe_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (event_type),
  INDEX (processed),
  INDEX (created_at)
);

-- migrate:down
DROP TABLE IF EXISTS stripe_events;
