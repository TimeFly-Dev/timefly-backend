import { clickhouseClient } from '../db/clickhouse'
import type { codingTime, codingTimeOptions, Pulse, PulsesOptions, DashboardTimelineItem, Entity, TimeRange, RawResult, TopItem, TopItemsProps, TopItemsResponse, GroupedRawResult, GroupedTimePeriodItem } from '../types/stats'
import { formatDuration } from '../utils/timeFormatters'

// Get entity configuration (field name and condition)
const getEntityConfig = (entity: Entity): { field: string; condition: string } => {
	const config: Record<Entity, { field: string; condition: string }> = {
		languages: { field: 'language', condition: "AND language != ''" },
		ides: { field: 'entity', condition: "AND entity != ''" },
		projects: { field: 'project', condition: "AND project != ''" },
		machines: { field: 'machine_name_id', condition: "AND machine_name_id != ''" }
	};

	if (!config[entity]) {
		throw new Error(`Invalid entity: ${entity}`);
	}
	return config[entity];
};

// Build date filter clause based on timeRange or custom date range
const buildDateFilterClause = (timeRange: TimeRange, startDate?: string, endDate?: string): string => {
	// If custom date range is provided, use it
	if (startDate || endDate) {
		let clause = '';
		if (startDate) {
			clause += ` AND start_time >= toDateTime('${startDate}')`;
		}
		if (endDate) {
			clause += ` AND end_time <= toDateTime('${endDate}')`;
		}
		return clause;
	}

	// Otherwise use timeRange
	const timeRangeFilters: Record<TimeRange, string> = {
		// Rolling window filters
		day: " AND start_time >= now() - INTERVAL 1 DAY",
		week: " AND start_time >= now() - INTERVAL 7 DAY",
		month: " AND start_time >= now() - INTERVAL 30 DAY",
		year: " AND start_time >= now() - INTERVAL 365 DAY",
		all: '' // No filter for 'all'
	};

	return timeRangeFilters[timeRange] || '';
};

// Build the complete SQL query
const buildTopItemsQuery = (
	userId: number,
	entity: Entity,
	timeRange: TimeRange,
	startDate?: string,
	endDate?: string,
	limit = 5
): string => {
	const { field: groupByField, condition: whereCondition } = getEntityConfig(entity);
	const baseWhereClause = `WHERE user_id = ${userId} ${whereCondition}`;
	const dateFilter = buildDateFilterClause(timeRange, startDate, endDate);
	const whereClause = `${baseWhereClause}${dateFilter}`;

	return `
    SELECT 
      ${groupByField} as name,
      SUM(dateDiff('second', start_time, end_time)) as total_seconds,
      MAX(end_time) as last_used,
      argMax(project, end_time) as last_project
    FROM aggregated_pulses
      ${whereClause}
      GROUP BY ${groupByField}
      ORDER BY total_seconds DESC
    LIMIT ${limit}
  `;
};

// Transform raw query results into formatted items
const transformTopItems = (data: RawResult[], entity: Entity): TopItem[] => {
	return data.map((row) => ({
		name: row.name,
		time: Number(row.total_seconds),
		formattedTime: formatDuration(Number(row.total_seconds) / 3600),
		lastUsed: new Date(row.last_used).toISOString(),
		// Only include lastProject if it's not the same as the entity name (for projects)
		...(entity === 'projects' ? {} : { lastProject: row.last_project })
	}));
};

// Main function to get top items
export async function getTopItems(props: TopItemsProps): Promise<TopItemsResponse> {
	// Extract and default parameters
	const { 
		userId, 
		timeRange = 'day', 
		entity = 'projects', 
		startDate, 
		endDate, 
		limit = 5 
	} = props;

	// Build query
	const query = buildTopItemsQuery(userId, entity, timeRange, startDate, endDate, limit);
	
	// Execute query
	const result = await clickhouseClient.query({
		query,
		format: 'JSONEachRow'
	});

	// Process results
	const data = (await result.json()) as RawResult[];
	const items = transformTopItems(data, entity);

	// Return formatted response
	return {
		timeRange,
		[entity]: items
	};
}

// Build query for items grouped by time periods
const buildTopItemsGroupedByTimeQuery = (
	userId: number,
	entity: Entity,
	timeRange: TimeRange,
	// startDate and endDate are currently not used for grouped queries but kept for future flexibility
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_startDate?: string,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_endDate?: string 
): string => {
	const { field: groupByField, condition: whereCondition } = getEntityConfig(entity);
	const baseWhereClause = `WHERE user_id = ${userId} ${whereCondition}`;
	
	let dateFilter = '';
	let selectPeriodFields = '';
	let groupByPeriod = '';
	
	switch(timeRange) {
		case 'day':
			dateFilter = ' AND start_time >= date_sub(now(), INTERVAL 7 DAY)';
			selectPeriodFields = 'toDate(start_time) AS period_start_date';
			groupByPeriod = 'period_start_date';
			break;
		case 'week':
			dateFilter = ' AND start_time >= date_sub(now(), INTERVAL 7 WEEK)';
			selectPeriodFields = `
				toStartOfWeek(start_time) AS period_start_date,
				date_add(toStartOfWeek(start_time), INTERVAL 6 DAY) AS period_end_date
			`;
			groupByPeriod = 'period_start_date, period_end_date';
			break;
		case 'month':
			dateFilter = ' AND start_time >= date_sub(now(), INTERVAL 7 MONTH)';
			selectPeriodFields = 'toStartOfMonth(start_time) AS period_start_date';
			groupByPeriod = 'period_start_date';
			break;
		default: // Default to daily if timeRange is 'all' or 'year' for this specific grouped view
			dateFilter = ' AND start_time >= date_sub(now(), INTERVAL 7 DAY)';
			selectPeriodFields = 'toDate(start_time) AS period_start_date';
			groupByPeriod = 'period_start_date';
	}

	const whereClause = `${baseWhereClause}${dateFilter}`;

	return `
		SELECT 
			${selectPeriodFields},
			${groupByField} as name,
			SUM(dateDiff('second', start_time, end_time)) as total_seconds,
			MAX(end_time) as last_used,
			argMax(project, end_time) as last_project
		FROM aggregated_pulses
		${whereClause}
		GROUP BY ${groupByPeriod}, ${groupByField}
		ORDER BY period_start_date DESC, total_seconds DESC
	`;
};

// Types moved to ../types/stats.ts

// Helper to format a date as YYYY-MM-DD
const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Transform raw query results into time-grouped formatted items
const transformGroupedTopItems = (data: GroupedRawResult[], entity: Entity, timeRange: TimeRange): GroupedTimePeriodItem[] => {
	const ITEMS_BEFORE_AGGREGATION = 4; // Show top 4 items, aggregate the rest
	const groupedData: Record<string, TopItem[]> = {};
	const periodOrder: string[] = []; // To maintain the order of periods

	data.forEach(row => {
		let periodKey: string;
		// displayPeriod is determined later during mapping, so not needed here directly for grouping key

		const periodStartDate = new Date(row.period_start_date);

		switch (timeRange) {
			case 'day':
				periodKey = formatDate(periodStartDate);
				break;
			case 'week': {
				const periodEndDate = row.period_end_date ? new Date(row.period_end_date) : new Date(periodStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
				periodKey = `${formatDate(periodStartDate)}_${formatDate(periodEndDate)}`;
				break;
			}
			case 'month':
				periodKey = `${periodStartDate.toLocaleString('default', { month: 'long' })} ${periodStartDate.getFullYear()}`;
				break;
			default: 
				periodKey = formatDate(periodStartDate);
				break;
		}

		if (!groupedData[periodKey]) {
			groupedData[periodKey] = [];
			periodOrder.push(periodKey); 
		}

		const totalSeconds = Number(row.total_seconds);
		groupedData[periodKey].push({
			name: row.name,
			time: totalSeconds,
			formattedTime: formatDuration(totalSeconds / 3600), // Convert seconds to hours for formatting
			lastUsed: row.last_used,
			...(entity === 'projects' ? {} : { lastProject: row.last_project }),
		});
	});

	// Aggregate small items into 'Others' for each period
	periodOrder.forEach(periodKey => {
		const itemsForPeriod = groupedData[periodKey];

		// Sort by time descending to identify top items
		itemsForPeriod.sort((a, b) => b.time - a.time);

		if (itemsForPeriod.length > ITEMS_BEFORE_AGGREGATION) {
			const topItems = itemsForPeriod.slice(0, ITEMS_BEFORE_AGGREGATION);
			const otherItemsToAggregate = itemsForPeriod.slice(ITEMS_BEFORE_AGGREGATION);

			const othersTotalTime = otherItemsToAggregate.reduce((sum, item) => sum + item.time, 0);

			if (othersTotalTime > 0) {
				let othersLastUsedDate = new Date(0); // Initialize with a very old date
				let itemWithMaxLastUsedInOthers: TopItem | undefined = undefined;

				otherItemsToAggregate.forEach(item => {
					const currentLastUsedDate = new Date(item.lastUsed);
					if (currentLastUsedDate > othersLastUsedDate) {
						othersLastUsedDate = currentLastUsedDate;
						itemWithMaxLastUsedInOthers = item;
					}
				});

				const othersItem: TopItem = {
					name: 'Others',
					time: othersTotalTime,
					formattedTime: formatDuration(othersTotalTime / 3600), // Convert seconds to hours for formatting
					lastUsed: othersLastUsedDate.toISOString(),
				};

				if (entity !== 'projects' && itemWithMaxLastUsedInOthers && itemWithMaxLastUsedInOthers.lastProject) {
					othersItem.lastProject = itemWithMaxLastUsedInOthers.lastProject;
				}
				groupedData[periodKey] = [...topItems, othersItem];
			} else {
				// If 'Others' group has no time, just keep the top items (or all items if less than threshold)
				groupedData[periodKey] = topItems;
			}
		} // No changes needed if itemsForPeriod.length <= ITEMS_BEFORE_AGGREGATION
	});

	// Sort periods chronologically from old to new
	const sortedPeriodOrder = [...periodOrder].sort((a, b) => {
		// For week format (startDate_endDate)
		if (timeRange === 'week') {
			const aStartDate = new Date(a.split('_')[0]);
			const bStartDate = new Date(b.split('_')[0]);
			return aStartDate.getTime() - bStartDate.getTime();
		} 
		// For month format (Month YYYY)
		if (timeRange === 'month') {
			const aMonthYear = a.split(' ');
			const bMonthYear = b.split(' ');
			const aYear = Number.parseInt(aMonthYear[1]);
			const bYear = Number.parseInt(bMonthYear[1]);
			if (aYear !== bYear) { return aYear - bYear };
			
			// Same year, compare months
			const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			return months.indexOf(aMonthYear[0]) - months.indexOf(bMonthYear[0]);
		}
		// For day format (YYYY-MM-DD)
		return new Date(a).getTime() - new Date(b).getTime();
	});

	// Map to the final array structure with chronological order
	return sortedPeriodOrder.map(key => {
		let displayPeriodValue: string | { startDate: string; endDate: string };
		if (timeRange === 'week') {
			const [startStr, endStr] = key.split('_');
			displayPeriodValue = { startDate: startStr, endDate: endStr };
		} else {
			displayPeriodValue = key; 
		}
		return {
			period: displayPeriodValue,
			items: groupedData[key]
		};
	});
};

// Main function to get top items grouped by time periods
export async function getTopItemsGroupedByTime(props: TopItemsProps): Promise<Record<string, unknown>> {
	async function executeQuery(query: string): Promise<GroupedRawResult[]> {
		const result = await clickhouseClient.query({
			query,
			format: 'JSONEachRow'
		});
		return await result.json() as GroupedRawResult[];
	}

	function validateTimeRange(timeRange: TimeRange): TimeRange {
		const validTimeRanges: TimeRange[] = ['day', 'week', 'month'];
		return validTimeRanges.includes(timeRange) ? timeRange : 'day';
	}

	function formatResponse(data: GroupedTimePeriodItem[], entity: Entity, timeRange: TimeRange): Record<string, unknown> {
		return {
			timeRange,
			[entity]: data
		};
	}

	const { userId, timeRange, entity = 'projects', startDate, endDate } = props;
	const effectiveTimeRange = validateTimeRange(timeRange);
	const query = buildTopItemsGroupedByTimeQuery(userId, entity, effectiveTimeRange, startDate, endDate);
	const data = await executeQuery(query);
	const groupedItemsArray = transformGroupedTopItems(data, entity, effectiveTimeRange);

	return formatResponse(groupedItemsArray, entity, effectiveTimeRange);
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
 * Get the percentage distribution of states from aggregated pulses
 * @param userId - User ID
 * @param startDate - Start date in ISO format
 * @param endDate - End date in ISO format
 * @param period - Time period (day, week, month, year, all)
 * @returns Object with state names as keys and their percentage as values
 */
export async function getPulseStates({
	userId,
	startDate,
	endDate,
	period = 'day'
}: {
	userId: number
	startDate?: string
	endDate?: string
	period?: 'day' | 'week' | 'month' | 'year' | 'all'
}): Promise<Record<string, number>> {
	// Build the where clause based on the parameters
	// Ensure we only get records with valid states (coding or debugging)
	let whereClause = `WHERE user_id = ${userId}`

	// apply date filters: custom range overrides period
	if (startDate || endDate) {
		if (startDate) {
			whereClause += ` AND start_time >= toDateTime('${startDate}')`
		}
		if (endDate) {
			whereClause += ` AND end_time <= toDateTime('${endDate}')`
		}
	} else {
		switch (period) {
			case 'day':
				whereClause += ' AND toDate(start_time) = today()'
				break
			case 'week':
				whereClause += ' AND toStartOfWeek(start_time) = toStartOfWeek(now())'
				break
			case 'month':
				whereClause += ' AND toStartOfMonth(start_time) = toStartOfMonth(now())'
				break
			case 'year':
				whereClause += ' AND toStartOfYear(start_time) = toStartOfYear(now())'
				break
		}
	}

	// Query to get total time and time per state
	const query = `
		WITH total AS (
			SELECT SUM(dateDiff('second', start_time, end_time)) as total_time
			FROM aggregated_pulses
			${whereClause}
		)
		SELECT 
			state,
			SUM(dateDiff('second', start_time, end_time)) as state_time,
			(SUM(dateDiff('second', start_time, end_time)) / (SELECT total_time FROM total)) * 100 as percentage
		FROM aggregated_pulses
		${whereClause}
		GROUP BY state
		ORDER BY state_time DESC
	`

	try {
		// Execute the query with proper error handling
		const result = await clickhouseClient.query({
			query,
			format: 'JSONEachRow'
		})

		// Parse the result
		const data = await result.json() as Array<{ state: string; state_time: string; percentage: number }>

		// Handle case where no data is returned
		if (data.length === 0) {
			return {}
		}

		// Transform the array into an object with state as key and percentage as value
		// Using functional approach with reduce
		const statePercentages = data.reduce((acc, { state, percentage }) => {
			// Convert state to lowercase for consistency and ensure it's a valid state
			if (state && typeof state === 'string') {
				const stateKey = state.toLowerCase()
				// Round percentage to 2 decimal places
				acc[stateKey] = Math.round(Number(percentage) * 100) / 100
			}
			return acc
		}, {} as Record<string, number>)

		// Return all detected states without expecting specific values
		return statePercentages
	} catch (error) {
		console.error('Error fetching pulse states:', error)
		return {}
	}
}

/**
 * Get the total time spent coding from aggregated pulses
 * @param userId - User ID
 * @param startDate - Start date in ISO format
 * @param endDate - End date in ISO format
 * @param aggregation - Time period aggregation (daily, weekly, monthly, yearly, total)
 * @returns Total coding time in seconds and formatted duration
 */
export async function getCodingTime({
	userId,
	startDate,
	endDate,
	aggregation = 'total'
}: codingTimeOptions) {

	const getDefaultStartDate = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
	const getDefaultEndDate = () => new Date().toISOString();

	const start = startDate || getDefaultStartDate();
	const end = endDate || getDefaultEndDate();

	// Validate aggregation type using a predefined set of valid values
	const validAggregations = new Set(['daily', 'weekly', 'monthly', 'yearly', 'total']);
	if (!validAggregations.has(aggregation)) {
		throw new Error(`Invalid aggregation type: ${aggregation}`);
	}

	// Format dates for ClickHouse using pure functions
	const formatDateForClickHouse = (dateStr: string): string => {
		return new Date(dateStr)
			.toISOString()
			.replace('T', ' ')
			.substring(0, 19);
	};

	// Apply formatting to dates
	const formattedStartDate = formatDateForClickHouse(start);
	const formattedEndDate = formatDateForClickHouse(end);

	// Use a more reliable query that ensures non-zero results when pulses exist
	const query = `
		SELECT
			COALESCE(SUM(dateDiff('second', start_time, end_time)), 0) as total_time,
			COUNT(*) as pulse_count
		FROM
			aggregated_pulses
		WHERE
			user_id = {userId: UInt32}
			AND start_time >= {startDate: DateTime}
			AND end_time <= {endDate: DateTime}
	`;

	// Define interface for the total time results
	interface TotalTimeResult {
		total_time: string | number; // ClickHouse may return strings for numeric values
		pulse_count: string | number;
	}

	try {
		// Execute query with parameters
		const result = await clickhouseClient.query({
			query,
			query_params: {
				userId,
				startDate: formattedStartDate,
				endDate: formattedEndDate
			},
			format: 'JSONEachRow'
		});

		// Parse result using functional approach
		const data = await result.json() as TotalTimeResult[];

		// Use optional chaining and nullish coalescing for safer data access
		const totalTimeSeconds = Number(data?.[0]?.total_time ?? 0);
		const pulseCount = Number(data?.[0]?.pulse_count ?? 0);

		// Calculate hours using pure function
		const secondsToHours = (seconds: number): number => {
			return Math.round(seconds / 3600);
		};

		// Return formatted result with additional metadata
		return {
			hours: secondsToHours(totalTimeSeconds),
			seconds: totalTimeSeconds,
			pulseCount
		};
	} catch (error) {
		console.error('Error fetching total time:', error);
		// Return a safe default in case of error
		return {
			hours: 0,
			seconds: 0,
			pulseCount: 0,
			error: 'Failed to fetch total time'
		};
	}
}

/**
 * Get the total time spent coding from aggregated pulses
 * @param userId - User ID
 * @param startDate - Start date in ISO format
 * @param endDate - End date in ISO format
 * @param aggregation - Time period aggregation (daily, weekly, monthly, yearly, total)
 * @returns Total coding time in seconds and formatted duration
 */
export async function getCombinedcodingTime({
	userId,
	startDate,
	endDate,
	date,
	aggregation
}: codingTimeOptions): Promise<codingTime[]> {
	// This function would be useful if you want to include both individual pulses and aggregated pulses
	// For now, we'll focus on using the aggregated_pulses table for statistics since it's more efficient

	// Implementation would be similar to getCodingTime but with a UNION query
	// between pulses and aggregated_pulses tables

	// For most statistics purposes, using just the aggregated_pulses table is recommended
	// as it already contains the summarized data

	const result = await getCodingTime({ userId, startDate, endDate, date, aggregation });

	// Transform the result into the expected codingTime[] format
	// Use the current date or provided date as the date property
	const formattedDate = date || new Date().toISOString().split('T')[0];

	// Convert hours to string format as required by the codingTime interface
	return [{
		date: formattedDate,
		hours: result.hours.toString()
	}];
}
