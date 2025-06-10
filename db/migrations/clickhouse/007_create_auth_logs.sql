-- migrate:up
CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID DEFAULT generateUUIDv4(),
  timestamp DateTime64(3),
  user_id UInt32,
  email String,
  success UInt8,
  ip_address String,
  user_agent String,
  country_code LowCardinality(String),
  city LowCardinality(String),
  provider Enum('google' = 1, 'github' = 2, 'local' = 3),
  error_message String DEFAULT '',
  session_id String DEFAULT '',
  event_type Enum('login' = 1, 'logout' = 2, 'token_refresh' = 3, 'failed' = 4, 'session_created' = 5, 'session_refreshed' = 6, 'session_expired' = 7, 'session_revoked' = 8),
  device_name String DEFAULT '',
  device_type String DEFAULT '',
  browser String DEFAULT '',
  os String DEFAULT '',
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, user_id);

-- migrate:down
DROP TABLE IF EXISTS auth_logs;
