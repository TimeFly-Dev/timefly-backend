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

// Query Implementations
const queries = {
  /**
   * Get today's coding activity timeline for a user
   */
  async getTodaysActivity() {
    return {
      data: {
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

  if(!queryName) { return {} as T }
  
  const query = queries[queryName as keyof typeof queries]
  
  if (!query) { throw new Error(`Query '${queryName}' does not exist in dashboardService`) }
  if (!params.userUuid) { throw new Error('userUuid is required') }
  
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
export const getTodaysActivity = (userUuid: string) =>
  executeQuery<{ data: { timeline: TimelineEntry[] } }>('getTodaysActivity', { userUuid })