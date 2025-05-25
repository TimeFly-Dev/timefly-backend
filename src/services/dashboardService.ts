// dashboardService.ts
import { clickhouseClient } from '@/db/clickhouse'

// Types
interface QueryParams {
  userId: string
  [key: string]: unknown
}

interface TimelineEntry {
  start: string
  end: string
  project: string
  time: number
}

// Query Implementations
const queries = {
  /**
   * Get today's coding activity timeline for a user
   */
  async getTodaysActivity({ userId }: QueryParams) {
    // const today = new Date().toISOString().split('T')[0]
    const today = '2025-01-01'

    // Query for computed activity totals from aggregated_pulses (primary source)
    const aggregatedTotalsQuery = `
    SELECT 
      SUM(if(state = 'coding', dateDiff('second', start_time, end_time), 0)) / 60 as coding,
      SUM(if(state = 'debugging', dateDiff('second', start_time, end_time), 0)) / 60 as debugging,
      SUM(if(entity LIKE '%read%' OR entity LIKE '%book%' OR entity LIKE '%doc%' OR entity LIKE '%pdf%' OR language = 'markdown' OR language = 'text', dateDiff('second', start_time, end_time), 0)) / 60 as reading
    FROM aggregated_pulses
    WHERE user_id = ${userId}
      AND toDate(start_time) = '${today}'
  `

    // Query for individual pulses that might not be aggregated yet
    const pulsesTotalsQuery = `
    SELECT 
      COUNT(if(state = 'coding', 1, NULL)) / 60 as coding,
      COUNT(if(state = 'debugging', 1, NULL)) / 60 as debugging,
      COUNT(if(entity LIKE '%read%' OR entity LIKE '%book%' OR entity LIKE '%doc%' OR entity LIKE '%pdf%' OR language = 'markdown' OR language = 'text', 1, NULL)) / 60 as reading
    FROM pulses
    WHERE user_id = ${userId}
      AND toDate(time) = '${today}'
  `

    // Query for timeline entries from aggregated_pulses
    const timelineQuery = `
    SELECT 
      start_time as start,
      end_time as end,
      project,
      dateDiff('minute', start_time, end_time) as time,
      entity,
      language,
      state
    FROM aggregated_pulses
    WHERE user_id = ${userId}
      AND toDate(start_time) = '${today}'
      AND dateDiff('second', start_time, end_time) > 0
    ORDER BY start_time
  `

    const [aggregatedTotalsResult, pulsesTotalsResult, timelineResult] = await Promise.all([
      clickhouseClient.query({ query: aggregatedTotalsQuery, format: 'JSONEachRow' }),
      clickhouseClient.query({ query: pulsesTotalsQuery, format: 'JSONEachRow' }),
      clickhouseClient.query({ query: timelineQuery, format: 'JSONEachRow' })
    ])

    const aggregatedTotals = (await aggregatedTotalsResult.json())[0] || { coding: 0, debugging: 0, reading: 0 }
    const pulsesTotals = (await pulsesTotalsResult.json())[0] || { coding: 0, debugging: 0, reading: 0 }

    // Combine totals (prioritize aggregated data, supplement with individual pulses)
    const computed = {
      coding: Math.round(aggregatedTotals.coding + pulsesTotals.coding),
      debugging: Math.round(aggregatedTotals.debugging + pulsesTotals.debugging),
      reading: Math.round(aggregatedTotals.reading + pulsesTotals.reading)
    }

    const timeline = await timelineResult.json()

    return {
      data: {
        computed,
        timeline
      }
    }
  },

  // getTotalTime
  async getTotalTime() {
    return {
      data: {
        
      }
    }
  },

  /**
   * Example query that returns test data
   */
  async getTestData({ userId }: QueryParams) {
    return { data: `Test data for user ${userId}` }
  }
}

// Public API

/**
 * Execute a single query by name
 */
export async function executeQuery<T = Record<string, unknown>>(
  queryName: string,
  params: QueryParams
): Promise<T> {

  if(!queryName) { return {} as T }
  
  const query = queries[queryName as keyof typeof queries]
  
  if (!query) { throw new Error(`Query '${queryName}' does not exist in dashboardService`) }
  if (!params.userId) { throw new Error('userId is required') }
  
  return query(params) as Promise<T>
}

/**
 * Execute multiple widget queries in parallel
 */
export interface WidgetQuery {
  uuid: string
  query: string
  userId: string
  [key: string]: unknown
}

export async function executeWidgetQueries(
  queries: WidgetQuery[]
) {
  const results = await Promise.all(
    queries.map(async ({ uuid, query, ...params }) => {
      try {
        const data = await executeQuery(query, params as QueryParams)
        // const data = "empty..."
        return [uuid, data] as const
      } catch (error) {
        console.error(`Error in query '${query}':`, error)
        return [
          uuid, 
          { 
            error: 'Query execution failed',
            details: error instanceof Error ? error.message : String(error)
          }
        ] as const
      }
    })
  )
  
  return Object.fromEntries(results)
}

// Individual query exports for direct usage
export const getTodaysActivity = (userId: string) =>
  executeQuery<{ data: { timeline: TimelineEntry[] } }>('getTodaysActivity', { userId })