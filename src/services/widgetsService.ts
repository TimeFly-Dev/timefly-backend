// widgetsService.ts
import { mysqlPool } from '@/db/mysql'
import { executeWidgetQueries } from './dashboardService'
import { v4 as uuidv4 } from 'uuid'

// Widget interface
export interface Widget {
  uuid: string
  name: string
  query: string
}

// Get all widgets
export const getWidgets = async (): Promise<Widget[]> => {
  const [rows] = await mysqlPool.execute(
    'SELECT uuid, name, query FROM timefly.widgets'
  )

  return rows.map(row => ({
    uuid: row.uuid,
    name: row.name,
    query: row.query
  }))
}

// Get user widgets with their data
export const getUserWidgets = async (userUuid: string): Promise<Record<string, unknown>[]> => {
  const [rows] = await mysqlPool.execute(
    `
    SELECT
      uhw.uuid as uuid,
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
    `,
    [userUuid]
  )

  const queriesToExecute = rows.map(row => ({ uuid: row.uuid, query: row.widget_query }))
  const widgetData = await executeWidgetQueries(queriesToExecute)

  // Map final results
  return rows.map((result) => ({
    uuid: result.uuid,
    widgetUuid: result.widget_uuid,
    widgetName: result.widget_name,
    widgetQuery: result.widget_query,
    created: result.created,
    props: result.props,
    widgetData: widgetData[result.uuid] || { data: {} }
  }))
}

// Insert a user_has_widgets record
export const postUserWidget = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const { userUuid, widgetUuid, props } = body

  const [result] = await mysqlPool.execute<mysql.RowDataPacket[]>(
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
    [
      uuidv4(),
      userUuid,
      widgetUuid,
      JSON.stringify(props) // asegura que se inserta como JSON válido
    ]
  )


  return result as unknown as Record<string, unknown>
}