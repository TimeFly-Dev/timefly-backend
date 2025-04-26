import { clickhouseClient } from '../db/clickhouse'
import { logger } from '../utils/logger'
import type { SessionDailyStat, SessionEventInput, SessionEventType, SessionStatsResponse } from '../types/sessions'

/**
 * Service for logging session events to ClickHouse
 */
export const sessionEventService = {
	/**
	 * Logs a session event
	 * @param {SessionEventInput} event - The event to log
	 * @returns {Promise<void>}
	 */
	logEvent: async (event: SessionEventInput): Promise<void> => {
		try {
			const eventTypeValue: SessionEventType =
				event.event_type === 'created' ? 1 : event.event_type === 'refreshed' ? 2 : event.event_type === 'expired' ? 3 : 4 // "revoked"

			logger.debug(`Preparing to log session event for user: ${event.user_id}`, {
				event_type: event.event_type,
				session_id: event.session_id,
				timestamp: event.timestamp
			})

			await clickhouseClient.insert({
				table: 'session_events',
				values: [
					{
						session_id: event.session_id,
						user_id: event.user_id,
						timestamp: event.timestamp,
						event_type: eventTypeValue,
						ip_address: event.ip_address,
						user_agent: event.user_agent,
						device_name: event.device_name || '',
						device_type: event.device_type || '',
						browser: event.browser || '',
						os: event.os || '',
						country_code: event.country_code || '',
						city: event.city || ''
					}
				],
				format: 'JSONEachRow'
			})

			logger.info(`Session event logged successfully for user: ${event.user_id}`, {
				event_type: event.event_type,
				session_id: event.session_id,
				timestamp: event.timestamp
			})
		} catch (error) {
			logger.error(`Failed to log session event for user ${event.user_id}:`, error)
			// Non-blocking - we don't want to fail the session operation if logging fails
		}
	},

	/**
	 * Gets session statistics for a user
	 * @param {number} userId - The user ID to get statistics for
	 * @param {Date} startDate - The start date for the statistics
	 * @param {Date} endDate - The end date for the statistics
	 * @returns {Promise<SessionStatsResponse>} The session statistics
	 */
	getStats: async (userId: number, startDate: Date, endDate: Date): Promise<SessionStatsResponse> => {
		try {
			logger.debug(`Fetching session stats for user: ${userId}`, {
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString()
			})

			const query = `
        SELECT 
          user_id,
          toDate(timestamp) as date,
          event_type,
          count() as event_count,
          arrayDistinct(groupArray(ip_address)) as unique_ips,
          arrayDistinct(groupArray(device_type)) as device_types,
          arrayDistinct(groupArray(browser)) as browsers,
          arrayDistinct(groupArray(os)) as operating_systems
        FROM session_events
        WHERE user_id = ${userId}
          AND timestamp >= toDateTime('${startDate.toISOString()}')
          AND timestamp <= toDateTime('${endDate.toISOString()}')
        GROUP BY user_id, date, event_type
        ORDER BY date DESC
      `

			const result = await clickhouseClient.query({
				query,
				format: 'JSONEachRow'
			})

			// Parse the JSON result into our type
			const rawData = await result.json()

			// Ensure rawData is an array and cast it to our type
			const data: readonly SessionDailyStat[] = Array.isArray(rawData) ? (rawData as SessionDailyStat[]) : []

			// Calculate totals
			const totalCreated = data.reduce((sum, stat) => sum + (stat.event_type === 1 ? stat.event_count : 0), 0)
			const totalRefreshed = data.reduce((sum, stat) => sum + (stat.event_type === 2 ? stat.event_count : 0), 0)
			const totalExpired = data.reduce((sum, stat) => sum + (stat.event_type === 3 ? stat.event_count : 0), 0)
			const totalRevoked = data.reduce((sum, stat) => sum + (stat.event_type === 4 ? stat.event_count : 0), 0)

			// Calculate unique devices across all records
			const allDevices = data.flatMap((stat) => stat.device_types)
			const uniqueDevices = new Set(allDevices).size

			logger.info(`Session stats retrieved successfully for user: ${userId}`, {
				recordCount: data.length,
				totalCreated,
				totalRefreshed,
				totalExpired,
				totalRevoked
			})

			return {
				success: true,
				data: {
					stats: data,
					totalCreated,
					totalRefreshed,
					totalExpired,
					totalRevoked,
					uniqueDevices
				}
			}
		} catch (error) {
			logger.error(`Failed to get session stats for user ${userId}:`, error)
			return {
				success: false,
				error: `Failed to retrieve session statistics: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	},

	/**
	 * Gets the most recent session events for a user
	 * @param {number} userId - The user ID to get events for
	 * @param {number} limit - Maximum number of events to return
	 * @returns {Promise<SessionStatsResponse>} The recent session events
	 */
	getRecentEvents: async (userId: number, limit = 10): Promise<SessionStatsResponse> => {
		try {
			logger.debug(`Fetching recent session events for user: ${userId}`, { limit })

			const query = `
        SELECT 
          user_id,
          toDate(timestamp) as date,
          event_type,
          1 as event_count,
          [ip_address] as unique_ips,
          [device_type] as device_types,
          [browser] as browsers,
          [os] as operating_systems
        FROM session_events
        WHERE user_id = ${userId}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `

			const result = await clickhouseClient.query({
				query,
				format: 'JSONEachRow'
			})

			// Parse the JSON result into our type
			const rawData = await result.json()

			// Ensure rawData is an array and cast it to our type
			const data: readonly SessionDailyStat[] = Array.isArray(rawData) ? (rawData as SessionDailyStat[]) : []

			// Count events by type
			const createdCount = data.filter((event) => event.event_type === 1).length
			const refreshedCount = data.filter((event) => event.event_type === 2).length
			const expiredCount = data.filter((event) => event.event_type === 3).length
			const revokedCount = data.filter((event) => event.event_type === 4).length

			// Calculate unique devices
			const allDevices = data.flatMap((stat) => stat.device_types)
			const uniqueDevices = new Set(allDevices).size

			logger.info(`Recent session events retrieved successfully for user: ${userId}`, {
				recordCount: data.length,
				createdCount,
				refreshedCount,
				expiredCount,
				revokedCount
			})

			return {
				success: true,
				data: {
					stats: data,
					totalCreated: createdCount,
					totalRefreshed: refreshedCount,
					totalExpired: expiredCount,
					totalRevoked: revokedCount,
					uniqueDevices
				}
			}
		} catch (error) {
			logger.error(`Failed to get recent session events for user ${userId}:`, error)
			return {
				success: false,
				error: `Failed to retrieve recent session events: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}
}
