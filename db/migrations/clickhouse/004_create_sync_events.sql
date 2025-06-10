-- migrate:up
CREATE TABLE IF NOT EXISTS sync_events (
  id UUID DEFAULT generateUUIDv4(),
  user_id UInt32,
  timestamp DateTime64(3),
  machine_name_id String,
  pulses_count UInt32,
  aggregated_pulses_count UInt32,
  sync_duration_ms UInt32,
  success Bool,
  error_message String DEFAULT '',
  request_id String,
  timezone String,
  user_agent String,
  ip_address String,
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, timestamp);

-- migrate:down
DROP TABLE IF EXISTS sync_events;
