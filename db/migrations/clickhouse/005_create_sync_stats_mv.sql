-- migrate:up
CREATE MATERIALIZED VIEW IF NOT EXISTS sync_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, date)
AS SELECT
  user_id,
  toDate(timestamp) as date,
  count() as total_syncs,
  sum(pulses_count) as total_pulses,
  sum(aggregated_pulses_count) as total_aggregated_pulses,
  avg(sync_duration_ms) as avg_sync_duration,
  sum(if(success, 1, 0)) as successful_syncs,
  sum(if(not success, 1, 0)) as failed_syncs,
  arrayDistinct(groupArray(timezone)) as timezones,
  arrayDistinct(groupArray(user_agent)) as user_agents,
  arrayDistinct(groupArray(ip_address)) as ip_addresses
FROM sync_events
GROUP BY user_id, date;

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS sync_stats;
