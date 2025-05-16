// dashboardService.ts
import { mysqlPool } from '@/db/mysql'

// Widget data providers
const widgetQueries = {
  'test': async () => ({
    data: {
      totalUsers: 1250,
      activeUsers: 875,
      newUsersThisMonth: 120
    }
  })
}

export const executeWidgetQueries = async (
  queries: { uuid: string; query: string }[]
): Promise<Record<string, Record<string, unknown>>> =>
  Object.fromEntries(
    await Promise.all(
      queries.map(async ({ uuid, query }) => [
        uuid,
        widgetQueries[query] ? await widgetQueries[query]() : { data: {} }
      ])
    )
  )