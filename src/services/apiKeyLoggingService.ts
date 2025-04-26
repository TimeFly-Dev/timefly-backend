import { clickhouseClient } from '../db/clickhouse'
import { logger } from '../utils/logger'
import type { ApiKeyDailyStat, ApiKeyEventInput, ApiKeyEventType, ApiKeyStatsResponse } from '../types/apiKeyEvents'
import { formatDateForClickHouse } from '../utils/timeFormatters'

/**
 * Service for logging API key events to ClickHouse
 */
export const apiKeyLoggingService = {
	/**
	 * Logs an API key event
	 * @param {ApiKeyEventInput} event - The event to log
	 * @returns {Promise<void>}
	 */
	logEvent: async (event: ApiKeyEventInput): Promise<void> => {
		try {
			const eventTypeValue: ApiKeyEventType = event.event_type === 'created' ? 1 : 2

			// Format the timestamp for ClickHouse
			const formattedTimestamp = formatDateForClickHouse(event.timestamp)

			logger.debug(`Preparing to log API key event for user: ${event.user_id}`, {
				event_type: event.event_type,
				timestamp: formattedTimestamp
			})

			await clickhouseClient.insert({
				table: 'api_key_events',
				values: [
					{
						user_id: event.user_id,
						// Use the formatted timestamp instead of the Date object
						timestamp: formattedTimestamp,
						event_type: eventTypeValue,
						ip_address: event.ip_address,
						user_agent: event.user_agent,
						country_code: event.country_code || '',
						city: event.city || ''
					}
				],
				format: 'JSONEachRow'
			})

			logger.info(`API key event logged successfully for user: ${event.user_id}`, {
				event_type: event.event_type,
				timestamp: formattedTimestamp
			})
		} catch (error) {
			logger.error(`Failed to log API key event for user ${event.user_id}:`, error)
			// Non-blocking - we don't want to fail the API key operation if logging fails
		}
	},

	/**
	 * Gets API key statistics for a user
	 * @param {number} userId - The user ID to get statistics for
	 * @param {Date} startDate - The start date for the statistics
	 * @param {Date} endDate - The end date for the statistics
	 * @returns {Promise<ApiKeyStatsResponse>} The API key statistics
	 */
	getStats: async (userId: number, startDate: Date, endDate: Date): Promise<ApiKeyStatsResponse> => {
		try {
			logger.debug(`Fetching API key stats for user: ${userId}`, {
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString()
			})

			// Format dates for ClickHouse
			const formattedStartDate = formatDateForClickHouse(startDate)
			const formattedEndDate = formatDateForClickHouse(endDate)

			const query = `
      SELECT 
        user_id,
        toDate(timestamp) as date,
        event_type,
        count() as event_count
      FROM api_key_events
      WHERE user_id = ${userId}
        AND timestamp >= toDateTime('${formattedStartDate}')
        AND timestamp <= toDateTime('${formattedEndDate}')
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
			const data: readonly ApiKeyDailyStat[] = Array.isArray(rawData) ? (rawData as ApiKeyDailyStat[]) : []

			// Calculate totals - convert string values to numbers
			const totalCreated = data.reduce((sum, stat) => {
				// Check if event_type is 1 (created) or "created"
				const isCreated = stat.event_type === 1 || stat.event_type === 'created' || String(stat.event_type) === '1'
				// Convert event_count to number if it's a string
				const count = typeof stat.event_count === 'string' ? Number.parseInt(stat.event_count, 10) : stat.event_count
				return sum + (isCreated ? count : 0)
			}, 0)

			const totalRegenerated = data.reduce((sum, stat) => {
				// Check if event_type is 2 (regenerated) or "regenerated"
				const isRegenerated = stat.event_type === 2 || stat.event_type === 'regenerated' || String(stat.event_type) === '2'
				// Convert event_count to number if it's a string
				const count = typeof stat.event_count === 'string' ? Number.parseInt(stat.event_count, 10) : stat.event_count
				return sum + (isRegenerated ? count : 0)
			}, 0)

			logger.info(`API key stats retrieved successfully for user: ${userId}`, {
				recordCount: data.length,
				totalCreated,
				totalRegenerated
			})

			return {
				success: true,
				data: {
					stats: data,
					totalCreated,
					totalRegenerated
				}
			}
		} catch (error) {
			logger.error(`Failed to get API key stats for user ${userId}:`, error)
			return {
				success: false,
				error: `Failed to retrieve API key statistics: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	},

	/**
	 * Gets the most recent API key events for a user
	 * @param {number} userId - The user ID to get events for
	 * @param {number} limit - Maximum number of events to return
	 * @returns {Promise<ApiKeyStatsResponse>} The recent API key events
	 */
	getRecentEvents: async (userId: number, limit = 10): Promise<ApiKeyStatsResponse> => {
		try {
			logger.debug(`Fetching recent API key events for user: ${userId}`, { limit })

			const query = `
        SELECT 
          user_id,
          toDate(timestamp) as date,
          event_type,
          1 as event_count
        FROM api_key_events
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
			const data: readonly ApiKeyDailyStat[] = Array.isArray(rawData) ? (rawData as ApiKeyDailyStat[]) : []

			// Count events by type
			const createdCount = data.filter((event) => event.event_type === 1).length
			const regeneratedCount = data.filter((event) => event.event_type === 2).length

			logger.info(`Recent API key events retrieved successfully for user: ${userId}`, {
				recordCount: data.length,
				createdCount,
				regeneratedCount
			})

			return {
				success: true,
				data: {
					stats: data,
					totalCreated: createdCount,
					totalRegenerated: regeneratedCount
				}
			}
		} catch (error) {
			logger.error(`Failed to get recent API key events for user ${userId}:`, error)
			return {
				success: false,
				error: `Failed to retrieve recent API key events: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}
}
