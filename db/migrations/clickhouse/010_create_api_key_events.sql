-- migrate:up
CREATE TABLE IF NOT EXISTS api_key_events (
  id UUID DEFAULT generateUUIDv4(),
  user_id UInt32,
  timestamp DateTime64(3),
  event_type Enum('created' = 1, 'regenerated' = 2, 'revoked' = 3, 'last_used' = 4),
  ip_address String,
  user_agent String,
  country_code LowCardinality(String) DEFAULT '',
  city LowCardinality(String) DEFAULT '',
  device_name String DEFAULT '',
  device_type String DEFAULT '',
  browser String DEFAULT '',
  os String DEFAULT '',
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, timestamp);

-- migrate:down
DROP TABLE IF EXISTS api_key_events;
