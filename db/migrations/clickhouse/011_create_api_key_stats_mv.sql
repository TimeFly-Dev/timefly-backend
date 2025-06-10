-- migrate:up
CREATE MATERIALIZED VIEW IF NOT EXISTS api_key_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, date, event_type)
AS SELECT
  user_id,
  toDate(timestamp) as date,
  event_type,
  count() as event_count,
  arrayDistinct(groupArray(ip_address)) as unique_ips,
  arrayDistinct(groupArray(user_agent)) as unique_user_agents,
  arrayDistinct(groupArray(country_code)) as countries,
  arrayDistinct(groupArray(device_type)) as device_types,
  arrayDistinct(groupArray(browser)) as browsers,
  arrayDistinct(groupArray(os)) as operating_systems
FROM api_key_events
GROUP BY user_id, date, event_type;

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS api_key_stats;
