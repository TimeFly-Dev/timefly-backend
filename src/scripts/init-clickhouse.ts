import { clickhouseClient } from '../db/clickhouse'

async function initClickhouse() {
	try {
		await clickhouseClient.exec({
			query: `
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
        SETTINGS index_granularity = 8192
      `
		})

		await clickhouseClient.exec({
			query: `
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
        SETTINGS index_granularity = 8192
      `
		})

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
        FROM aggregated_pulses
        GROUP BY user_id, date, project, language
      `
		})

		await clickhouseClient.exec({
			query: `
        CREATE TABLE IF NOT EXISTS sync_events (
          id UUID DEFAULT generateUUIDv4(),
          user_id UInt32,
          timestamp DateTime64(3),
          machine_name_id String,
          pulses_count UInt32,
          aggregated_pulses_count UInt32,
          sync_duration_ms UInt32,
          success Bool,
          error_message String DEFAULT '',
          request_id String,
          timezone String,
          user_agent String,
          ip_address String,
          created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (user_id, timestamp)
      `
		})

		// Add materialized view for sync statistics
		await clickhouseClient.exec({
			query: `
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
        GROUP BY user_id, date
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
          session_id String DEFAULT '',
          event_type Enum('login' = 1, 'logout' = 2, 'token_refresh' = 3, 'failed' = 4, 'session_created' = 5, 'session_refreshed' = 6, 'session_expired' = 7, 'session_revoked' = 8),
          device_name String DEFAULT '',
          device_type String DEFAULT '',
          browser String DEFAULT '',
          os String DEFAULT '',
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
        GROUP BY user_id, date, success, event_type
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

		// API key events table
		await clickhouseClient.exec({
			query: `
        CREATE TABLE IF NOT EXISTS api_key_events (
          id UUID DEFAULT generateUUIDv4(),
          user_id UInt32,
          timestamp DateTime64(3),
          event_type Enum('created' = 1, 'regenerated' = 2, 'revoked' = 3, 'last_used' = 4),
          ip_address String,
          user_agent String,
          country_code LowCardinality(String) DEFAULT '',
          city LowCardinality(String) DEFAULT '',
          device_name String DEFAULT '',
          device_type String DEFAULT '',
          browser String DEFAULT '',
          os String DEFAULT '',
          created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        PARTITION BY toYYYYMM(timestamp)
        ORDER BY (user_id, timestamp)
      `
		})

		// API key statistics materialized view
		await clickhouseClient.exec({
			query: `
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
        GROUP BY user_id, date, event_type
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
