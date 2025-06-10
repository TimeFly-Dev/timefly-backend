-- migrate:up
CREATE TABLE IF NOT EXISTS pulses (
  id UUID DEFAULT generateUUIDv4(),
  user_id UInt32,
  entity String,
  type Enum('file' = 1, 'app' = 2, 'domain' = 3),
  state Enum('coding' = 1, 'debugging' = 2),
  time DateTime64(3),
  project String DEFAULT '',
  project_root_count UInt16 DEFAULT 0,
  branch String DEFAULT '',
  language String DEFAULT '',
  dependencies String DEFAULT '',
  machine_name_id String,
  line_additions UInt32 DEFAULT 0,
  line_deletions UInt32 DEFAULT 0,
  lines UInt32 DEFAULT 0,
  lineno UInt32 DEFAULT 0,
  cursorpos UInt32 DEFAULT 0,
  is_write UInt8 DEFAULT 0,
  timezone String,
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(time)
ORDER BY (user_id, time, entity)
SETTINGS index_granularity = 8192;

-- migrate:down
DROP TABLE IF EXISTS pulses;
