-- migrate:up
CREATE TABLE IF NOT EXISTS export_events (
  id UUID DEFAULT generateUUIDv4(),
  user_id UInt32,
  timestamp DateTime64(3),
  entries_count UInt32,
  file_size_bytes UInt64,
  processing_time_ms UInt32,
  start_date DateTime64(3) NULL,
  end_date DateTime64(3) NULL,
  expires_at DateTime64(3),
  email_sent Bool,
  cleaned_up Bool DEFAULT false,
  error_message String DEFAULT '',
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, timestamp);

-- migrate:down
DROP TABLE IF EXISTS export_events;
