import { clickhouseClient } from '../db/clickhouse'
import type { CodingHours, CodingStatsOptions, ClickHouseResult, TotalCodingHours, TopLanguage, TopLanguageRaw } from '../types/stats'
import { formatDuration, formatDateRange } from '../utils/timeFormatters'

export async function getCodingStats({ userId, startDate, endDate, date, aggregation }: CodingStatsOptions): Promise<CodingHours[]> {
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

	const query = `
		SELECT ${selectClause}
		FROM time_entries
		${whereClause}
		${groupBy}
	`

	const result = await clickhouseClient.query({
		query,
		format: 'JSONEachRow'
	})

	const data = (await result.json()) as ClickHouseResult[]

	if (aggregation === 'total') {
		const totalData = data as TotalCodingHours[]
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

	return (data as CodingHours[]).map((row) => ({
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
	let whereClause = `WHERE user_id = ${userId}`
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

	const query = `
		SELECT 
			language,
			SUM(dateDiff('second', start_time, end_time)) as total_seconds,
			MAX(end_time) as last_used,
			argMax(project, end_time) as last_project
		FROM time_entries
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
