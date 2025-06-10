-- migrate:up
CREATE MATERIALIZED VIEW IF NOT EXISTS auth_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, date, success, event_type)
AS SELECT
  user_id,
  toDate(timestamp) as date,
  success,
  event_type,
  count() as attempts,
  arrayDistinct(groupArray(ip_address)) as unique_ips,
  arrayDistinct(groupArray(user_agent)) as unique_user_agents,
  arrayDistinct(groupArray(country_code)) as countries,
  arrayDistinct(groupArray(device_type)) as device_types,
  arrayDistinct(groupArray(browser)) as browsers,
  arrayDistinct(groupArray(os)) as operating_systems
FROM auth_logs
GROUP BY user_id, date, success, event_type;

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS auth_stats;
