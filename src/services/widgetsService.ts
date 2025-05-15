import { mysqlPool } from '@/db/mysql'
import type mysql from 'mysql2/promise'

export interface Widget {
  uuid: string
  name: string
  query: string
}

export async function getWidgets(): Promise<Widget[]> {
  const [rows] = await mysqlPool.execute<mysql.RowDataPacket[]>(
    'SELECT uuid, name, query FROM timefly.widgets'
  )

  return rows.map(row => ({
    uuid: row.uuid,
    name: row.name,
    query: row.query
  }))
}

export async function getUserWidgets(userUuid: string): Promise<Record<string, unknown>[]>{
  const [rows] = await mysqlPool.execute<mysql.RowDataPacket[]>(
    `
    SELECT
      uhw.uuid as uuid,
      w.uuid as widget_uuid,
      w.name as widget_name,
      w.query as widget_query,
      uhw.skin,
      uhw.time_range,
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

  // const queriesToExecute = rows.map(row => row.widget_query)

  return rows.map(({
    uuid,
    widget_uuid,
    widget_name,
    widget_query,
    created,
    ...rest
  }) => ({
    uuid,
    widgetUuid: widget_uuid,
    widgetName: widget_name,
    widgetQuery: widget_query,
    created,
    props: rest,
    widgetData: {}
  }))
}
