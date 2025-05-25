// widgetsService.ts
import { mysqlPool } from '@/db/mysql'
import { executeWidgetQueries } from './dashboardService'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

// Common interface for widget data
interface WidgetData extends RowDataPacket {
  uuid: string
  widget_uuid: string
  widget_name: string
  widget_query: string
  props: string | Record<string, unknown>
  created: string
}

// Helper function to fetch widget data by UUID
const fetchWidgetByUuid = async (userWidgetUuid: string): Promise<WidgetData> => {
  const [widgets] = await mysqlPool.execute<WidgetData[]>(
    `
    SELECT 
      uhw.uuid as uuid,
      w.uuid as widget_uuid,
      w.name as widget_name,
      w.query as widget_query,
      uhw.props as props,
      uhw.created_at as created
    FROM 
      timefly.users_has_widgets uhw
    JOIN 
      timefly.widgets w ON w.id = uhw.widget_id
    WHERE 
      uhw.uuid = ?
    `,
    [userWidgetUuid]
  )

  if (!Array.isArray(widgets) || widgets.length === 0) {
    throw new Error('User widget not found')
  }

  return widgets[0]
}

// Helper function to format widget response
const formatWidgetResponse = (widget: WidgetData) => ({
  uuid: widget.uuid,
  position: widget.position,
  widgetUuid: widget.widget_uuid,
  widgetName: widget.widget_name,
  widgetQuery: widget.widget_query,
  created: widget.created,
  props: typeof widget.props === 'string' ? JSON.parse(widget.props) : widget.props,
  widgetData: {}
})

// Widget interface
export interface Widget extends RowDataPacket {
  uuid: string
  name: string
  query: string
}

// Get all widgets
export const getWidgets = async (): Promise<Widget[]> => {
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(
    'SELECT uuid, name, query FROM timefly.widgets'
  )
  return (Array.isArray(rows) ? rows : []) as Widget[]
}

// Get user widgets with their data
export const getUserWidgets = async (userUuid: string): Promise<Record<string, unknown>[]> => {
  const [rows] = await mysqlPool.execute<WidgetData[]>(
    `
    SELECT
      uhw.uuid as uuid,
      uhw.position as position,
      w.uuid as widget_uuid,
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
      u.uuid = ?
    ORDER BY
      uhw.position ASC
    `,
    [userUuid]
  )

  if (!Array.isArray(rows)) {
    return []
  }

  const queriesToExecute = rows.map((row) => ({
    uuid: row.uuid,
    query: row.widget_query,
    userId: row.user_id
  }))
  
  const widgetData = await executeWidgetQueries(queriesToExecute)

  return rows.map(row => ({
    ...formatWidgetResponse(row),
    widgetData: widgetData[row.uuid] || {}
  }))
}

// Insert a user_has_widgets record
export const postUserWidget = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const { userUuid, widgetUuid, props } = body
  const userWidgetUuid = crypto.randomUUID()

  try {
    // Insert the user-widget relationship
    await mysqlPool.execute<ResultSetHeader>(
      `
      INSERT INTO 
        timefly.users_has_widgets (uuid, user_id, widget_id, props)
      VALUES (
        ?, 
        (SELECT id FROM timefly.users WHERE uuid = ?),
        (SELECT id FROM timefly.widgets WHERE uuid = ?),
        ?
      )
      `,
      [userWidgetUuid, userUuid, widgetUuid, JSON.stringify(props)]
    )

    // Fetch and return the created widget
    const widget = await fetchWidgetByUuid(userWidgetUuid)
    return formatWidgetResponse(widget)
  } catch (error) {
    if (error instanceof Error && error.message.includes('a foreign key constraint fails')) {
      throw new Error('User or widget not found')
    }
    throw error
  }
}

// Update a user's widget props
export const updateUserWidget = async (userWidgetUuid: string, props: Record<string, unknown>): Promise<Record<string, unknown>> => {
  // Update the user-widget relationship
  const [result] = await mysqlPool.execute<ResultSetHeader>(
    `
    UPDATE timefly.users_has_widgets
    SET props = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE uuid = ?
    `,
    [JSON.stringify(props), userWidgetUuid]
  )

  if (result.affectedRows === 0) {
    throw new Error('User widget not found')
  }

  // Fetch and return the updated widget
  const widget = await fetchWidgetByUuid(userWidgetUuid)
  return formatWidgetResponse(widget)
}

// Delete a user's widget
export const deleteUserWidget = async (userWidgetUuid: string): Promise<boolean> => {
  const [result] = await mysqlPool.execute<ResultSetHeader>(
    `
    DELETE FROM timefly.users_has_widgets
    WHERE uuid = ?
    `,
    [userWidgetUuid]
  )

  return result.affectedRows > 0
}

// Update multiple widgets' positions for a user
export const updateUserWidgetsPosition = async (
  widgets: Array<{ usersHasWidgetsUuid: string; position: number }>
): Promise<boolean> => {
  await Promise.all(
    widgets.map(({ position, usersHasWidgetsUuid }) =>
      mysqlPool.execute(
        `UPDATE timefly.users_has_widgets 
         SET position = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE uuid = ?`,
        [position, usersHasWidgetsUuid]
      )
    )
  )
  return true
}