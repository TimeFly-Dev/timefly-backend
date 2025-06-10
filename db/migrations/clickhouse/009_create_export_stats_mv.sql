-- migrate:up
CREATE MATERIALIZED VIEW IF NOT EXISTS export_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, date)
AS SELECT
  user_id,
  toDate(timestamp) as date,
  count() as total_exports,
  sum(entries_count) as total_entries,
  sum(file_size_bytes) as total_size,
  avg(processing_time_ms) as avg_processing_time,
  sum(if(error_message != '', 1, 0)) as failed_exports,
  sum(cleaned_up) as cleaned_up_exports
FROM export_events
GROUP BY user_id, date;

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS export_stats;
