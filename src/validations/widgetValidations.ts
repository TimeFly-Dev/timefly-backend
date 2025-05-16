import { z } from 'zod'
import 'zod-openapi/extend'


// GET /widgets
export const widgetsSchema = z
  .object({})
  .openapi({ ref: 'WidgetsOptions' })
export const widgetsResponseSchema = z
  .object({
    data: z.array(
      z.object({
        uuid: z.string(),
        name: z.string(),
        query: z.string(),
      })
    )
  })
  .openapi({ ref: 'WidgetsResponse' });

// GET /user-widgets
export const userWidgetsSchema = z
  .object({
    userUuid: z.string().describe('UUID of the user for which to retrieve the widgets')
  })
  .openapi({ ref: 'UserWidgetsOptions' })
export const userWidgetsResponseSchema = z
  .object({
    data: z.array(
      z.object({
        uuid: z.string(),
        widgetUuid: z.string(),
        widgetName: z.string(),
        widgetQuery: z.string(),
        created: z.string(),
        props: z.object({}),
        widgetData: z.object({})
      })
    )
  })
  .openapi({ ref: 'UserWidgetsResponse' })

// POST /user-widget
export const postUserWidgetSchema = z
  .object({
    userUuid: z.string().describe('UUID of the user'),
    widgetUuid: z.string().describe('UUID of the widget to insert'),
    props: z.object({}).describe('Widget props (e.g. skin, timeRange)')
  })
  .openapi({ ref: 'PostUserWidgetOptions' })

export const postUserWidgetResponseSchema = z
  .object({
    data: z.array(
      z.object({
        uuid: z.string(),
        widgetUuid: z.string(),
        widgetName: z.string(),
        widgetQuery: z.string(),
        created: z.string(),
        props: z.object({}),
        widgetData: z.object({})
      })
    )
  })

// PUT /user-widget
export const putUserWidgetSchema = z
  .object({
    userUuid: z.string().describe('UUID of the user'),
    widgetUuid: z.string().describe('UUID of the widget to update'),
    props: z.object({}).describe('Widget props (e.g. skin, timeRange)')
  })
  .openapi({ ref: 'PutUserWidgetOptions' })

export const putUserWidgetResponseSchema = z
  .object({
    data: z.array(
      z.object({
        uuid: z.string(),
        widgetUuid: z.string(),
        widgetName: z.string(),
        widgetQuery: z.string(),
        created: z.string(),
        props: z.object({}),
        widgetData: z.object({})
      })
    )
  })

  // DELETE /user-widget
export const deleteUserWidgetSchema = z
  .object({
    userUuid: z.string().describe('UUID of the user'),
    widgetUuid: z.string().describe('UUID of the widget to delete')
  })
  .openapi({ ref: 'DeleteUserWidgetOptions' })
