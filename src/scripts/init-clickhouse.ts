import { clickhouseClient } from '../db/clickhouse'

async function initClickhouse() {
	try {
		// Main time tracking entries table
		await clickhouseClient.exec({
			query: `
        CREATE TABLE IF NOT EXISTS time_entries (
          id UUID DEFAULT generateUUIDv4(),
          user_id UInt32,
          entity String,
          type Enum('file' = 1, 'folder' = 2),
          category Enum('coding' = 1, 'reading' = 2, 'debugging' = 3),
          start_time DateTime64(3),
          end_time DateTime64(3),
          project String,
          branch String,
          language String,
          dependencies String,
          machine_name_id String,
          line_additions UInt32,
          line_deletions UInt32,
          lines UInt32,
          is_write Bool,
          timezone String,
          created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(start_time)
        ORDER BY (user_id, start_time, project, language)
        SETTINGS index_granularity = 8192
      `
		})

		// Daily aggregated statistics view
		await clickhouseClient.exec({
			query: `
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
        FROM time_entries
        GROUP BY user_id, date, project, language
      `
		})

		// Authentication attempts logging table
		await clickhouseClient.exec({
			query: `
        CREATE TABLE IF NOT EXISTS auth_logs (
          id UUID DEFAULT generateUUIDv4(),
          timestamp DateTime64(3),
          user_id UInt32,
          email String,
          success UInt8,
          ip_address String,
          user_agent String,
          country_code LowCardinality(String),
          city LowCardinality(String),
          provider Enum('google' = 1, 'github' = 2, 'local' = 3),
          error_message String DEFAULT '',
          created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (timestamp, user_id)
      `
		})

		// Authentication statistics materialized view
		await clickhouseClient.exec({
			query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS auth_stats
        ENGINE = SummingMergeTree()
        PARTITION BY toYYYYMM(date)
        ORDER BY (user_id, date, success)
        AS SELECT
          user_id,
          toDate(timestamp) as date,
          success,
          count() as attempts,
          arrayDistinct(groupArray(ip_address)) as unique_ips,
          arrayDistinct(groupArray(user_agent)) as unique_user_agents,
          arrayDistinct(groupArray(country_code)) as countries
        FROM auth_logs
        GROUP BY user_id, date, success
      `
		})

		// Synchronization events tracking table
		await clickhouseClient.exec({
			query: `
        CREATE TABLE IF NOT EXISTS sync_events (
          id UUID DEFAULT generateUUIDv4(),
          user_id UInt32,
          timestamp DateTime64(3),
          machine_name_id String,
          entries_count UInt32,
          sync_duration_ms UInt32,
          success Bool,
          error_message String DEFAULT '',
          created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (user_id, timestamp)
      `
		})

		console.log('ClickHouse tables and views created successfully')
	} catch (error) {
		console.error('Error creating ClickHouse tables:', error)
	} finally {
		await clickhouseClient.close()
	}
}

initClickhouse()
