-- migrate:up
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, date, project, language)
AS SELECT
  user_id,
  toDate(start_time) as date,
  project,
  language,
  count() as total_entries,
  sum(dateDiff('second', start_time, end_time)) as total_seconds,
  sum(line_additions) as total_additions,
  sum(line_deletions) as total_deletions,
  sum(lines) as total_lines,
  max(end_time) as last_activity
FROM aggregated_pulses
GROUP BY user_id, date, project, language;

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS daily_stats;
