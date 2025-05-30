import { clickhouseClient } from '../db/clickhouse'
import { logger } from '../utils/logger'
import type { AuthDailyStat, AuthStatsResponse } from '../types/authEvents'

/**
 * Service for retrieving authentication statistics from ClickHouse
 */
export const authStatsService = {
	/**
	 * Gets authentication statistics for a user
	 * @param {number} userId - The user ID to get statistics for
	 * @param {Date} startDate - The start date for the statistics
	 * @param {Date} endDate - The end date for the statistics
	 * @returns {Promise<AuthStatsResponse>} The authentication statistics
	 */
	getStats: async (userId: number, startDate: Date, endDate: Date): Promise<AuthStatsResponse> => {
		try {
			logger.debug(`Fetching auth stats for user: ${userId}`, {
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString()
			})

			// Format dates for ClickHouse (YYYY-MM-DD HH:mm:ss)
			const formatDate = (date: Date) => {
				const pad = (n: number) => n.toString().padStart(2, '0')
				return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
			}

			const query = `
        SELECT 
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
        WHERE user_id = ${userId}
          AND timestamp >= toDateTime('${formatDate(startDate)}')
          AND timestamp <= toDateTime('${formatDate(endDate)}')
        GROUP BY user_id, date, success, event_type
        ORDER BY date DESC
      `

			const result = await clickhouseClient.query({
				query,
				format: 'JSONEachRow'
			})

			// Parse the JSON result into our type
			const rawData = await result.json()

			// Ensure rawData is an array and cast it to our type
			const data: readonly AuthDailyStat[] = Array.isArray(rawData) ? (rawData as AuthDailyStat[]) : []

			// Calculate totals
			const totalSuccess = data.reduce((sum, stat) => sum + (stat.success ? stat.attempts : 0), 0)
			const totalFailure = data.reduce((sum, stat) => sum + (!stat.success ? stat.attempts : 0), 0)

			// Calculate unique IPs and countries across all records
			const allIPs = data.flatMap((stat) => stat.unique_ips)
			const allCountries = data.flatMap((stat) => stat.countries)
			const allDevices = data.flatMap((stat) => stat.device_types || [])
			const uniqueIPs = new Set(allIPs).size
			const uniqueCountries = new Set(allCountries).size
			const uniqueDevices = new Set(allDevices).size

			logger.info(`Auth stats retrieved successfully for user: ${userId}`, {
				recordCount: data.length,
				totalSuccess,
				totalFailure,
				uniqueIPs,
				uniqueCountries,
				uniqueDevices
			})

			return {
				success: true,
				data: {
					stats: data,
					totalSuccess,
					totalFailure,
					uniqueIPs,
					uniqueCountries,
					uniqueDevices
				}
			}
		} catch (error) {
			logger.error(`Failed to get auth stats for user ${userId}:`, error)
			return {
				success: false,
				error: `Failed to retrieve authentication statistics: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	},

	/**
	 * Gets the most recent authentication events for a user
	 * @param {number} userId - The user ID to get events for
	 * @param {number} limit - Maximum number of events to return
	 * @returns {Promise<AuthStatsResponse>} The recent authentication events
	 */
	getRecentEvents: async (userId: number, limit = 10): Promise<AuthStatsResponse> => {
		try {
			logger.debug(`Fetching recent auth events for user: ${userId}`, { limit })

			const query = `
        SELECT 
          user_id,
          toDate(timestamp) as date,
          success,
          event_type,
          1 as attempts,
          [ip_address] as unique_ips,
          [user_agent] as unique_user_agents,
          [country_code] as countries,
          [device_type] as device_types,
          [browser] as browsers,
          [os] as operating_systems
        FROM auth_logs
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
			const data: readonly AuthDailyStat[] = Array.isArray(rawData) ? (rawData as AuthDailyStat[]) : []

			// Count events by success/failure
			const successCount = data.filter((event) => event.success).length
			const failureCount = data.filter((event) => !event.success).length

			// Calculate unique IPs and countries
			const allIPs = data.flatMap((stat) => stat.unique_ips)
			const allCountries = data.flatMap((stat) => stat.countries)
			const allDevices = data.flatMap((stat) => stat.device_types || [])
			const uniqueIPs = new Set(allIPs).size
			const uniqueCountries = new Set(allCountries).size
			const uniqueDevices = new Set(allDevices).size

			logger.info(`Recent auth events retrieved successfully for user: ${userId}`, {
				recordCount: data.length,
				successCount,
				failureCount,
				uniqueIPs,
				uniqueCountries,
				uniqueDevices
			})

			return {
				success: true,
				data: {
					stats: data,
					totalSuccess: successCount,
					totalFailure: failureCount,
					uniqueIPs,
					uniqueCountries,
					uniqueDevices
				}
			}
		} catch (error) {
			logger.error(`Failed to get recent auth events for user ${userId}:`, error)
			return {
				success: false,
				error: `Failed to retrieve recent authentication events: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}
}
