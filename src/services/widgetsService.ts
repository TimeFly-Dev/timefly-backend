// widgetsService.ts
import { mysqlPool } from '@/db/mysql'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

// Common interface for widget data
interface WidgetData extends RowDataPacket {
  id: string
  widget_id: string
  widget_name: string
  widget_query: string
  props: string | Record<string, unknown>
  created: string
}

// Import all functions from statsService to execute widget queries dynamically
import * as statsService from './statsService'

// Define a type for widget query data
interface WidgetQuery {
  id: number | string;
  widget_id: number | string;
  widget_name: string;
  widget_query: string;
  props: Record<string, unknown> | string;
  created: string;
  timeRange?: string;
  [key: string]: unknown; // Para cualquier otra propiedad que pueda existir
}

// Execute widget queries will import functions from statsService resolving their names by widget_query
const executeWidgetQueries = async (userId: string, queries: WidgetQuery[]) => {
  console.log("QUERIES TO EXECUTE:", queries)

  // Execute each function dynamically from statsService based on the widget_query name
  const results = await Promise.all(
    queries.map(async (query) => {
      try {
        const functionName = query.widget_query.trim() as keyof typeof statsService
        
        if (typeof statsService[functionName] === 'function') {
          // Definir un tipo más específico para la función
          type StatsFunctionType = (params: Record<string, unknown>) => Promise<unknown>
          const statsFunction = statsService[functionName] as StatsFunctionType
          
          // Create a 30-day lookback window as default
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          // Format dates for ClickHouse (YYYY-MM-DD HH:MM:SS)
          const formatDateForClickHouse = (date: Date) => {
            return date.toISOString().replace('T', ' ').substring(0, 19);
          };
          
          const formattedStartDate = formatDateForClickHouse(thirtyDaysAgo);
          const formattedEndDate = formatDateForClickHouse(new Date());
          
          // Extract props properly - handle nested props structure
          const widgetProps = typeof query.props === 'object' && query.props 
            ? (query.props.props || query.props) 
            : {};
          
          // Set time range based on props or default
          const timeRange = widgetProps.timeRange || 'month';
          
          // Determine aggregation based on timeRange for getTotalTime
          let _aggregation = 'daily';
          if (functionName === 'getTotalTime') {
            switch(timeRange) {
              case 'day': _aggregation = 'daily'; break;
              case 'week': _aggregation = 'weekly'; break;
              case 'month': _aggregation = 'monthly'; break;
              case 'year': _aggregation = 'yearly'; break;
              default: _aggregation = 'daily';
            }
          }
          
          // Ensure dates are properly formatted for ClickHouse
          const params: Record<string, unknown> = {
            userId: Number(userId) || 4, // Default userId if not provided
            startDate: formattedStartDate, // Last 30 days
            endDate: formattedEndDate
          }
          
          // Add any props from the widget
          if (widgetProps) {
            Object.assign(params, widgetProps)
          }
          
          // Set default timeRange if not provided
          if (!params.timeRange) {
            params.timeRange = 'month'
          }
          
          // For getTotalTime, set aggregation if not provided
          if (functionName === 'getTotalTime' && !params.aggregation) {
            params.aggregation = 'daily'
          }
          
          const data = await statsFunction(params)
          return { id: query.id, data: data }
        }
        
        console.error(`Function ${String(functionName)} not found in statsService`)
        return { id: query.id, data: [], error: `Function ${String(functionName)} not found` }
      } catch (error: unknown) {
        console.error(`Error executing widget query for ${query.id}:`, error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { id: query.id, data: [], error: errorMessage }
      }
    })
  )

  return Object.fromEntries(results.map(result => [result.id, result.data]))
}

// Helper function to fetch widget data by ID
const fetchWidgetById = async (widgetId: string): Promise<WidgetData> => {
  const [widgets] = await mysqlPool.execute<WidgetData[]>(
    `
    SELECT 
      uhw.id as id,
      w.id as widget_id,
      w.name as widget_name,
      w.query as widget_query,
      uhw.props as props,
      uhw.created_at as created
    FROM 
      timefly.users_has_widgets uhw
    JOIN 
      timefly.widgets w ON w.id = uhw.widget_id
    WHERE 
      w.id = ?
    `,
    [widgetId]
  )

  if (!Array.isArray(widgets) || widgets.length === 0) {
    throw new Error('User widget not found')
  }

  return widgets[0]
}

// Helper function to format widget response
const formatWidgetResponse = (widget: WidgetData) => ({
  id: widget.id,
  position: widget.position,
  widgetId: widget.widget_id,
  widgetName: widget.widget_name,
  widgetQuery: widget.widget_query,
  created: widget.created,
  props: typeof widget.props === 'string' ? JSON.parse(widget.props) : widget.props,
  widgetData: {}
})

// Widget interface
export interface Widget extends RowDataPacket {
  id: string
  name: string
  query: string
}

// Get all widgets
export const getWidgets = async (): Promise<Widget[]> => {
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(
    'SELECT id, name, query FROM timefly.widgets'
  )
  return (Array.isArray(rows) ? rows : []) as Widget[]
}

// Get user widgets with their data
export const getUserWidgets = async (userId: string): Promise<Record<string, unknown>[]> => {
  const [rows] = await mysqlPool.execute<WidgetData[]>(
    `
    SELECT
      uhw.id as id,
      uhw.position as position,
      w.id as widget_id,
      w.name as widget_name,
      w.query as widget_query,
      uhw.props as props,
      uhw.created_at as created
    FROM
      timefly.widgets w
    JOIN
      timefly.users_has_widgets uhw ON w.id = uhw.widget_id
    JOIN
      timefly.users u ON u.id = uhw.user_id
    WHERE
      u.id = ?
    ORDER BY
      uhw.position ASC
    `,
    [userId]
  )

  if (!Array.isArray(rows)) {
    return []
  }

  const queriesToExecute = rows
    .filter(row => row.widget_query && row.widget_query.trim() !== '')
    .map((row) => ({
      id: row.id,
      widget_id: row.widget_id,
      widget_name: row.widget_name,
      widget_query: row.widget_query,
      props: row.props,
      created: row.created
    }))
  
  const widgetData = await executeWidgetQueries(userId, queriesToExecute)

  return rows.map(row => ({
    ...formatWidgetResponse(row),
    widgetData: widgetData[row.id] || {}
  }))
}

// Insert a user_has_widgets record
export const postUserWidget = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const { userId, widgetId, props } = body

  try {
    // Insert the user-widget relationship
    await mysqlPool.execute<ResultSetHeader>(
      `
      INSERT INTO 
        timefly.users_has_widgets (user_id, widget_id, props)
      VALUES (
        (SELECT id FROM timefly.users WHERE id = ?),
        (SELECT id FROM timefly.widgets WHERE id = ?),
        ?
      )
      `,
      [userId, widgetId, JSON.stringify(props)]
    )

    // Fetch and return the created widget
    const widget = await fetchWidgetById(widgetId)
    return formatWidgetResponse(widget)
  } catch (error) {
    if (error instanceof Error && error.message.includes('a foreign key constraint fails')) {
      throw new Error('User or widget not found')
    }
    throw error
  }
}

// Update a user's widget props
export const updateUserWidget = async (userWidgetId: string, props: Record<string, unknown>): Promise<Record<string, unknown>> => {
  // First, get the widget_id from the users_has_widgets record
  const [widgetRecords] = await mysqlPool.execute<RowDataPacket[]>(
    `
    SELECT widget_id 
    FROM timefly.users_has_widgets
    WHERE id = ?
    `,
    [userWidgetId]
  )

  if (!Array.isArray(widgetRecords) || widgetRecords.length === 0) {
    throw new Error('User widget not found')
  }

  const widgetId = widgetRecords[0].widget_id

  // Update the user-widget relationship
  const [result] = await mysqlPool.execute<ResultSetHeader>(
    `
    UPDATE timefly.users_has_widgets
    SET props = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [JSON.stringify(props), userWidgetId]
  )

  if (result.affectedRows === 0) {
    throw new Error('User widget not found')
  }

  // Fetch and return the updated widget using the widget_id
  const widget = await fetchWidgetById(widgetId)
  return formatWidgetResponse(widget)
}

// Delete a user's widget
export const deleteUserWidget = async (userWidgetId: string): Promise<boolean> => {
  const [result] = await mysqlPool.execute<ResultSetHeader>(
    `
    DELETE FROM timefly.users_has_widgets
    WHERE id = ?
    `,
    [userWidgetId]
  )

  return result.affectedRows > 0
}

// Update multiple widgets' positions for a user
export const updateUserWidgetsPosition = async (
  widgets: Array<{ usersHasWidgetsId: string; position: number }>
): Promise<boolean> => {
  await Promise.all(
    widgets.map(({ position, usersHasWidgetsId }) =>
      mysqlPool.execute(
        `UPDATE timefly.users_has_widgets 
         SET position = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [position, usersHasWidgetsId]
      )
    )
  )
  return true
}