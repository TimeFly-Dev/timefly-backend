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

		// Add new export_events table after sync_events
		await clickhouseClient.exec({
			query: `
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
        ORDER BY (user_id, timestamp)
      `
		})

		// Add materialized view for export statistics
		await clickhouseClient.exec({
			query: `
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
        GROUP BY user_id, date
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
