-- migrate:up
CREATE TABLE IF NOT EXISTS aggregated_pulses (
  id UUID DEFAULT generateUUIDv4(),
  user_id UInt32,
  entity String,
  type Enum('file' = 1, 'app' = 2, 'domain' = 3),
  state Enum('coding' = 1, 'debugging' = 2),
  start_time DateTime64(3),
  end_time DateTime64(3),
  project String DEFAULT '',
  branch String DEFAULT '',
  language String DEFAULT '',
  dependencies String DEFAULT '',
  machine_name_id String,
  line_additions UInt32 DEFAULT 0,
  line_deletions UInt32 DEFAULT 0,
  lines UInt32 DEFAULT 0,
  is_write UInt8 DEFAULT 0,
  timezone String,
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(start_time)
ORDER BY (user_id, start_time, entity)
SETTINGS index_granularity = 8192;

-- migrate:down
DROP TABLE IF EXISTS aggregated_pulses;
