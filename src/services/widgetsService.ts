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

// Utility functions for date handling and parameter preparation

// Format a date for ClickHouse (YYYY-MM-DD HH:MM:SS)
const formatDateForClickHouse = (date: Date): string => 
  date.toISOString().replace('T', ' ').substring(0, 19);

// Get default date range (30 days)
const _getDefaultDateRange = (): { startDate: string, endDate: string } => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return {
    startDate: formatDateForClickHouse(thirtyDaysAgo),
    endDate: formatDateForClickHouse(new Date())
  };
};

// Extract widget properties from query
const extractWidgetProps = (query: WidgetQuery): Record<string, unknown> => {
  if (typeof query.props !== 'object' || !query.props) {
    return {};
  }
  
  return (query.props.props as Record<string, unknown>) || 
         (query.props as Record<string, unknown>);
};

// Map timeRange to aggregation for getCodingTime
const mapTimeRangeToAggregation = (timeRange: string): string => {
  const aggregationMap: Record<string, string> = {
    'day': 'daily',
    'week': 'weekly',
    'month': 'monthly',
    'year': 'yearly'
  };
  
  return aggregationMap[timeRange] || 'daily';
};

// Prepare parameters for stats service functions
const prepareStatsParams = (userId: string, query: WidgetQuery): Record<string, unknown> => {
  const widgetProps = extractWidgetProps(query);
  const timeRange = widgetProps.timeRange as string || 'month';
  const functionName = query.widget_query.trim();
  
  // Base parameters without default dates - let statsService handle timeRange filtering
  const params: Record<string, unknown> = {
    userId: Number(userId),
    entity: widgetProps.entity || 'projects',
    limit: widgetProps.limit || 5,
    timeRange
  };
  
  // Only add date range if explicitly provided in widget props
  if (widgetProps.startDate) {
    params.startDate = widgetProps.startDate;
  }
  
  if (widgetProps.endDate) {
    params.endDate = widgetProps.endDate;
  }
  
  // Add widget-specific properties
  if (Object.keys(widgetProps).length > 0) {
    Object.assign(params, widgetProps);
  }
  
  // Add function-specific parameters
  if (functionName === 'getCodingTime' && !params.aggregation) {
    params.aggregation = mapTimeRangeToAggregation(timeRange);
  }
  
  return params;
};

// Execute a single widget query
const executeWidgetQuery = async (userId: string, query: WidgetQuery): Promise<{ id: number | string, data: unknown, error?: string }> => {
  try {
    const functionName = query.widget_query.trim() as keyof typeof statsService;
    
    if (typeof statsService[functionName] !== 'function') {
      return { 
        id: query.id, 
        data: [], 
        error: `Function ${String(functionName)} not found` 
      };
    }
    
    // Prepare parameters and execute the function
    type StatsFunctionType = (params: Record<string, unknown>) => Promise<unknown>;
    const statsFunction = statsService[functionName] as StatsFunctionType;
    const params = prepareStatsParams(userId, query);
    const data = await statsFunction(params);
    
    return { id: query.id, data };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { id: query.id, data: [], error: errorMessage };
  }
};

// Execute widget queries by dynamically importing functions from statsService
const executeWidgetQueries = async (userId: string, queries: WidgetQuery[]): Promise<Record<string | number, unknown>> => {
  // Execute all queries in parallel
  const results = await Promise.all(
    queries.map(query => executeWidgetQuery(userId, query))
  );

  // Transform results into a map of id -> data
  return Object.fromEntries(results.map(result => [result.id, result.data]));
}

// Helper function to fetch widget data by ID
const fetchWidgetById = async (widgetId: number, userId?: string): Promise<WidgetData & { widgetData?: unknown }> => {
  const [widgets] = await mysqlPool.execute<WidgetData[]>(
    `
    SELECT 
      uhw.id as id,
      w.id as widget_id,
      w.name as widget_name,
      w.query as widget_query,
      uhw.props as props,
      uhw.created_at as created,
      uhw.user_id as user_id
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

  const widget = widgets[0];
  
  // If userId is provided, execute the widget query to get widget data
  if (userId && widget.widget_query && widget.widget_query.trim() !== '') {
    // Reuse queriesToExecute logic with a single item
    const queriesToExecute = [{
      id: widget.id,
      widget_id: Number(widget.widget_id),
      widget_name: widget.widget_name,
      widget_query: widget.widget_query,
      props: widget.props,
      created: widget.created
    }];
    
    console.log('QUERIES TO EXECUTE:', queriesToExecute); 
    const widgetData = await executeWidgetQueries(userId, queriesToExecute);
    
    return {
      ...widget,
      widgetData: widgetData[widget.id]
    };
  }
  
  return widget;
}

// Helper function to format widget response
const formatWidgetResponse = (widget: WidgetData & { widgetData?: unknown }) => ({
  id: widget.id,
  position: widget.position,
  widgetId: widget.widget_id,
  widgetName: widget.widget_name,
  widgetQuery: widget.widget_query,
  created: widget.created,
  props: typeof widget.props === 'string' ? JSON.parse(widget.props) : widget.props,
  widgetData: widget.widgetData || {}
})

// Widget interface
export interface Widget extends RowDataPacket {
  id: string
  name: string
  default_props: string
}

// Get all widgets
export const getWidgets = async (): Promise<Widget[]> => {
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(
    'SELECT id, name, default_props FROM timefly.widgets'
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
      widget_id: Number(row.widget_id),
      widget_name: row.widget_name,
      widget_query: row.widget_query,
      props: row.props,
      created: row.created
    }))
  console.log('QUERIES TO EXECUTE: ', queriesToExecute)
  const widgetData = await executeWidgetQueries(userId, queriesToExecute)

  return rows.map(row => ({
    ...formatWidgetResponse(row),
    widgetData: widgetData[row.id] || {}
  }))
}

// Insert a user_has_widgets record
export const postUserWidget = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const { userId, widgetId, props } = body
  const widgetIdNumber = typeof widgetId === 'string' ? Number.parseInt(widgetId, 10) : Number(widgetId)
  
  if (Number.isNaN(widgetIdNumber)) {
    throw new Error('Invalid widget ID format')
  }

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
      [userId, widgetIdNumber, JSON.stringify(props)]
    )

    // Fetch the created widget with its data
    const widget = await fetchWidgetById(widgetIdNumber, userId as string)
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
  // First, get the widget_id and user_id from the users_has_widgets record
  const [widgetRecords] = await mysqlPool.execute<RowDataPacket[]>(
    `
    SELECT widget_id, user_id 
    FROM timefly.users_has_widgets
    WHERE id = ?
    `,
    [userWidgetId]
  )

  if (!Array.isArray(widgetRecords) || widgetRecords.length === 0) {
    throw new Error('User widget not found')
  }

  const widgetId = widgetRecords[0].widget_id
  const userId = widgetRecords[0].user_id

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

  // Fetch and return the updated widget using the widget_id and user_id to include widgetData
  const widget = await fetchWidgetById(widgetId, userId)
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