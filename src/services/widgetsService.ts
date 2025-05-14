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

export async function getWidgetById(id: number): Promise<Widget | null> {
  const [rows] = await mysqlPool.execute<mysql.RowDataPacket[]>(
    'SELECT uuid, name, query FROM timefly.widgets WHERE id = ?',
    [id]
  )

  const widget = rows[0]
  return widget
    ? {
      uuid: widget.uuid,
      name: widget.name,
      query: widget.query
    }
    : null
}