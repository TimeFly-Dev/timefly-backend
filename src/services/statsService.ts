import { clickhouseClient } from '../db/clickhouse'
import type { codingTime, codingTimeOptions, ClickHouseResult, TotalcodingTimes, TopLanguage, TopLanguageRaw, Pulse, PulsesOptions, DashboardResponse, DashboardTimelineItem } from '../types/stats'
import { formatDuration, formatDateRange } from '../utils/timeFormatters'

export async function getcodingTime({ userId, startDate, endDate, date, aggregation }: codingTimeOptions): Promise<codingTime[]> {
	let dateFunction: string
	let groupBy: string
	let selectClause: string
	let whereClause = `WHERE user_id = ${userId}`

	switch (aggregation) {
		case 'daily':
			dateFunction = 'toDate(start_time)'
			groupBy = 'GROUP BY date ORDER BY date'
			selectClause = `${dateFunction} as date, SUM(dateDiff('second', start_time, end_time)) / 3600 as hours`
			break
		case 'weekly':
			dateFunction = 'toStartOfWeek(start_time)'
			groupBy = 'GROUP BY date ORDER BY date'
			selectClause = `${dateFunction} as date, SUM(dateDiff('second', start_time, end_time)) / 3600 as hours`
			break
		case 'monthly':
			dateFunction = 'toStartOfMonth(start_time)'
			groupBy = 'GROUP BY date ORDER BY date'
			selectClause = `${dateFunction} as date, SUM(dateDiff('second', start_time, end_time)) / 3600 as hours`
			break
		case 'yearly':
			dateFunction = 'toStartOfYear(start_time)'
			groupBy = 'GROUP BY date ORDER BY date'
			selectClause = `${dateFunction} as date, SUM(dateDiff('second', start_time, end_time)) / 3600 as hours`
			break
		case 'total':
			dateFunction = ''
			groupBy = ''
			selectClause = `MIN(start_time) as start_date, MAX(end_time) as end_date, SUM(dateDiff('second', start_time, end_time)) / 3600 as total_hours`
			break
	}

	if (date) {
		whereClause += ` AND toDate(start_time) = toDate('${date}')`
	} else {
		if (startDate) {
			whereClause += ` AND start_time >= toDateTime('${startDate}')`
		}
		if (endDate) {
			whereClause += ` AND end_time <= toDateTime('${endDate}')`
		}
	}

	// Query the aggregated_pulses table directly
	const query = `
    SELECT ${selectClause}
    FROM aggregated_pulses
    ${whereClause}
    ${groupBy}
  `

	const result = await clickhouseClient.query({
		query,
		format: 'JSONEachRow'
	})

	const data = (await result.json()) as ClickHouseResult[]

	if (aggregation === 'total') {
		const totalData = data as TotalcodingTimes[]
		if (totalData.length > 0) {
			return [
				{
					date: formatDateRange(totalData[0].start_date, totalData[0].end_date),
					hours: formatDuration(Number(totalData[0].total_hours))
				}
			]
		}
		return []
	}

	return (data as codingTime[]).map((row) => ({
		date: row.date,
		hours: formatDuration(Number(row.hours))
	}))
}

export async function getTopLanguages({
	userId,
	startDate,
	endDate,
	limit = 10,
	period = 'all'
}: {
	userId: number
	startDate?: string
	endDate?: string
	limit?: number
	period?: 'day' | 'week' | 'month' | 'year' | 'all'
}): Promise<TopLanguage[]> {
	let whereClause = `WHERE user_id = ${userId} AND language != ''`
	let dateFunction: string

	switch (period) {
		case 'day':
			dateFunction = 'toDate(start_time)'
			whereClause += ` AND ${dateFunction} = today()`
			break
		case 'week':
			dateFunction = 'toStartOfWeek(start_time)'
			whereClause += ` AND ${dateFunction} = toStartOfWeek(now())`
			break
		case 'month':
			dateFunction = 'toStartOfMonth(start_time)'
			whereClause += ` AND ${dateFunction} = toStartOfMonth(now())`
			break
		case 'year':
			dateFunction = 'toStartOfYear(start_time)'
			whereClause += ` AND ${dateFunction} = toStartOfYear(now())`
			break
		default:
			dateFunction = 'toDate(start_time)'
	}

	if (startDate) {
		whereClause += ` AND start_time >= toDateTime('${startDate}')`
	}
	if (endDate) {
		whereClause += ` AND end_time <= toDateTime('${endDate}')`
	}

	// Query the aggregated_pulses table directly
	const query = `
    SELECT 
      language,
      SUM(dateDiff('second', start_time, end_time)) as total_seconds,
      MAX(end_time) as last_used,
      argMax(project, end_time) as last_project
    FROM aggregated_pulses
      ${whereClause}
      GROUP BY language
      ORDER BY total_seconds DESC
    LIMIT ${limit}
  `

	const result = await clickhouseClient.query({
		query,
		format: 'JSONEachRow'
	})

	const data = (await result.json()) as TopLanguageRaw[]

	return data.map((row) => ({
		language: row.language,
		hours: formatDuration(Number(row.total_seconds) / 3600),
		lastUsed: new Date(row.last_used).toISOString(),
		lastProject: row.last_project
	}))
}

export async function getPulses({
	userId,
	startDate,
	endDate,
	timeRange,
	responseFormat = 'default'
}: PulsesOptions): Promise<Pulse[] | Array<{ start: string; end: string; project: string; time: number }>> {
	let dateFunction = 'toDate(start_time)'
	let whereClause = `WHERE user_id = ${userId}`

	if (responseFormat === 'dashboard') {
		const todayStart = new Date()
		todayStart.setHours(0, 0, 0, 0)
		const todayStartStr = todayStart.toISOString().slice(0, 19).replace('T', ' ')
		whereClause += ` AND start_time >= toDateTime('${todayStartStr}')`
	} else if (!startDate && !endDate) {
		switch (timeRange) {
			case 'day':
				dateFunction = 'toDate(start_time)'
				whereClause += ' AND start_time >= subtractDays(now(), 1)'
				break
			case 'week':
				dateFunction = 'toStartOfWeek(start_time)'
				whereClause += ' AND start_time >= subtractDays(now(), 7)'
				break
			case 'month':
				dateFunction = 'toStartOfMonth(start_time)'
				whereClause += ' AND start_time >= subtractMonths(now(), 1)'
				break
		}
	} else {
		if (startDate) {
			whereClause += ` AND start_time >= toDateTime('${startDate}')`
		}
		if (endDate) {
			whereClause += ` AND end_time <= toDateTime('${endDate}')`
		}
	}

	const query = `
	SELECT 
	  ${dateFunction} as date,
	  project,
	  state,
	  dateDiff('second', start_time, end_time) as duration,
	  start_time,
	  end_time
	FROM aggregated_pulses
	${whereClause}
	ORDER BY start_time DESC
  `

	const result = await clickhouseClient.query({
		query,
		format: 'JSONEachRow'
	})

	const data = (await result.json()) as (Pulse & { state: string })[];

	if (responseFormat === 'dashboard') {
		const computed: Record<string, number> = {};
		
		data.forEach((row) => {
			const state = row.state.toLowerCase();
			const durationInMinutes = Math.round(Number(row.duration) / 60);
			
			if (!computed[state]) {
				computed[state] = 0;
			}
			computed[state] += durationInMinutes;
		});
		
		const timeline: DashboardTimelineItem[] = [];
		const sortedData = [...data].sort((a, b) => 
			new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
		);
		
		sortedData.forEach((row) => {
			const durationInMinutes = Math.round(Number(row.duration) / 60);
			const currentStart = new Date(row.start_time);
			const currentEnd = new Date(row.end_time);
			
			if (timeline.length > 0) {
				const lastPulse = timeline[timeline.length - 1];
				const lastEnd = new Date(lastPulse.end);
				const timeDifference = (currentStart.getTime() - lastEnd.getTime()) / (1000 * 60);
				
				if (timeDifference < 5) {
					lastPulse.end = row.end_time;
					const newDuration = (currentEnd.getTime() - new Date(lastPulse.start).getTime()) / (1000 * 60);
					lastPulse.time = Math.round(newDuration);
					
					if (lastPulse.project !== row.project) {
						// Mantenemos el proyecto existente
					}
					return;
				}
			}
			
			timeline.push({
				start: row.start_time,
				end: row.end_time,
				project: row.project,
				time: durationInMinutes
			});
		});
		
		return timeline;
	}

	return data.map((row) => ({
		start: row.start_time,
		end: row.end_time,
		project: row.project,
		time: Math.round(Number(row.duration) / 60)
	}))
}

/**
 * Get the total time spent coding from aggregated pulses
 * @param userId - User ID
 * @param startDate - Start date in ISO format
 * @param endDate - End date in ISO format
 * @param aggregation - Time period aggregation (daily, weekly, monthly, yearly, total)
 * @returns Total coding time in seconds and formatted duration
 */
export async function getTotalTime({
	userId,
	startDate,
	endDate,
	aggregation = 'daily'
}: codingTimeOptions) {
	// Ensure we have start and end dates
	const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
	const end = endDate || new Date().toISOString()

	// Validate the aggregation type
	switch (aggregation) {
		case 'daily':
		case 'weekly':
		case 'monthly':
		case 'yearly':
		case 'total':
			// Valid aggregation types
			break
		default:
			throw new Error(`Invalid aggregation type: ${aggregation}`)
	}

	// Query to get the total time from aggregated pulses
	const query = `
		SELECT
			SUM(dateDiff('second', start_time, end_time)) as total_time
		FROM
			aggregated_pulses
		WHERE
			user_id = {userId: UInt32}
			AND start_time >= {startDate: DateTime}
			AND end_time <= {endDate: DateTime}
	`

	// Format dates in the format ClickHouse expects (YYYY-MM-DD HH:MM:SS)
	const startDateObj = new Date(start);
	const endDateObj = new Date(end);
	
	// Format dates without milliseconds and timezone (YYYY-MM-DD HH:MM:SS)
	const formatDateForClickHouse = (date: Date) => {
		return date.toISOString().replace('T', ' ').substring(0, 19);
	};
	
	const formattedStartDate = formatDateForClickHouse(startDateObj);
	const formattedEndDate = formatDateForClickHouse(endDateObj);
	
	const result = await clickhouseClient.query({
		query,
		query_params: {
			userId,
			startDate: formattedStartDate,
			endDate: formattedEndDate
		}
	})

	// Define interface for the total time results
	interface TotalTimeResult {
		total_time: number
	}
	// Cast to the appropriate type
	const data = (await result.json()) as unknown as TotalTimeResult[]
	
	// If there's no data, return 0 hours
	if (!data || !data.length || !data[0].total_time) {
		return {
			hours: 0
		}
	}

	// Calculate hours from seconds and round to whole number
	const totalTimeSeconds = Number(data[0].total_time)
	const totalHours = Math.round(totalTimeSeconds / 3600)

	return {
		hours: totalHours
	}
}


export async function getCombinedcodingTime({
	userId,
	startDate,
	endDate,
	date,
	aggregation
}: codingTimeOptions): Promise<codingTime[]> {
	// This function would be useful if you want to include both individual pulses and aggregated pulses
	// For now, we'll focus on using the aggregated_pulses table for statistics since it's more efficient

	// Implementation would be similar to getcodingTime but with a UNION query
	// between pulses and aggregated_pulses tables

	// For most statistics purposes, using just the aggregated_pulses table is recommended
	// as it already contains the summarized data

	return getcodingTime({ userId, startDate, endDate, date, aggregation })
}
