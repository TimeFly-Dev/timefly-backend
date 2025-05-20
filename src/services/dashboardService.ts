// dashboardService.ts
import { clickhouseClient } from '@/db/clickhouse'

// Types
interface QueryParams {
  userUuid: string
  [key: string]: unknown
}

interface TimelineEntry {
  start: string
  end: string
  project: string
  time: number
}

interface PulseRow {
  start: string
  end: string
  project: string | null
  time_seconds: number
}

// Query Implementations
const queries = {
  /**
   * Get today's coding activity timeline for a user
   */
  async getTodaysActivity({ userUuid }: QueryParams) {
    const query = `
      SELECT 
        formatDateTime(start_time, '%Y-%m-%dT%H:%i:%S') as start,
        formatDateTime(end_time, '%Y-%m-%dT%H:%i:%S') as end,
        project,
        dateDiff('second', start_time, end_time) as time_seconds
      FROM aggregated_pulses
      WHERE 
        user_id = (SELECT id FROM users WHERE uuid = {userUuid: String} LIMIT 1)
        AND start_time >= toStartOfDay(now())
      ORDER BY start_time
    `

    try {
      const result = await clickhouseClient.query({
        query,
        format: 'JSONEachRow',
        query_params: { userUuid }
      })
      
const resultSet = await result.json()
      const rows = Array.isArray(resultSet) ? resultSet.flat() as PulseRow[] : []
      
      return {
        data: {
          timeline: rows.map(row => ({
            start: row.start,
            end: row.end,
            project: row.project || 'unknown',
            time: row.time_seconds
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching today\'s activity:', error)
      return { data: { timeline: [] } }
    }
  },

  /**
   * Example query that returns test data
   */
  async getTestData({ userUuid }: QueryParams) {
    return { data: `Test data for user ${userUuid}` }
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
  const query = queries[queryName as keyof typeof queries]
  
  if (!query) {
    throw new Error(`Query '${queryName}' not found`)
  }
  
  if (!params.userUuid) {
    throw new Error('userUuid is required')
  }
  
  return query(params) as Promise<T>
}

/**
 * Execute multiple widget queries in parallel
 */
export interface WidgetQuery {
  uuid: string
  query: string
  userUuid: string
  [key: string]: unknown
}

export async function executeWidgetQueries(
  queries: WidgetQuery[]
) {
  const results = await Promise.all(
    queries.map(async ({ uuid, query, ...params }) => {
      try {
        const data = await executeQuery(query, params as QueryParams)
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
export const getTodaysActivity = (userUuid: string) =>
  executeQuery<{ data: { timeline: TimelineEntry[] } }>('getTodaysActivity', { userUuid })