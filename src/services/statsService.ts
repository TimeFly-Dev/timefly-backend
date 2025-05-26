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
}: PulsesOptions): Promise<Pulse[] | DashboardResponse> {
	let dateFunction = 'toDate(start_time)'
	let whereClause = `WHERE user_id = ${userId}`

	// If startDate and endDate are provided, use them directly
	if (!startDate && !endDate) {
		// Otherwise, calculate the date range based on timeRange
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
		// If custom date range is provided
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
      language,
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

	// If responseFormat is dashboard, transform the data
	if (responseFormat === 'dashboard') {
		// Create the computed object with state counts
		const computed: Record<string, number> = {};
		
		// Process each pulse for computed stats
		data.forEach((row) => {
			// Add to computed stats by state
			const state = row.state.toLowerCase();
			const durationInMinutes = Math.round(Number(row.duration) / 60);
			
			if (!computed[state]) {
				computed[state] = 0;
			}
			computed[state] += durationInMinutes;
		});
		
		// Create timeline with merged pulses when time difference is < 5 minutes
		const timeline: DashboardTimelineItem[] = [];
		
		// Sort data by start time for processing in chronological order
		const sortedData = [...data].sort((a, b) => 
			new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
		);
		
		// Process pulses and merge them when appropriate
		sortedData.forEach((row) => {
			const durationInMinutes = Math.round(Number(row.duration) / 60);
			const currentStart = new Date(row.start_time);
			const currentEnd = new Date(row.end_time);
			
			// Check if we should merge with the previous pulse
			if (timeline.length > 0) {
				const lastPulse = timeline[timeline.length - 1];
				const lastEnd = new Date(lastPulse.end);
				const timeDifference = (currentStart.getTime() - lastEnd.getTime()) / (1000 * 60); // in minutes
				
				// If the time difference is less than 5 minutes, merge the pulses
				if (timeDifference < 5) {
					// Extend the end time of the last pulse
					lastPulse.end = row.end_time;
					
					// Update the duration
					const newDuration = (currentEnd.getTime() - new Date(lastPulse.start).getTime()) / (1000 * 60);
					lastPulse.time = Math.round(newDuration);
					
					// Keep the project name of the longest span or combine them if they're different
					if (lastPulse.project !== row.project) {
						// Option 1: Use the project with the longest duration
						// We'll stick with the existing project as we've already calculated its merged duration
						
						// Option 2: Combine project names if they differ
						// Uncomment this if you prefer combining project names
						// lastPulse.project = `${lastPulse.project}, ${row.project}`;
					}
					return; // Skip adding a new pulse since we merged with the existing one
				}
			}
			
			// Add as a new pulse if no merge occurred
			timeline.push({
				start: row.start_time,
				end: row.end_time,
				project: row.project,
				time: durationInMinutes
			});
		});
		
		return {
			computed,
			timeline
		};
	}

	// Default response format
	return data.map((row) => ({
		date: row.date,
		project: row.project,
		language: row.language,
		state: row.state,
		duration: Number(row.duration),
		start_time: row.start_time,
		end_time: row.end_time
	}))
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
