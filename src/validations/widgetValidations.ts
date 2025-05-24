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
    props: z.record(z.any()).describe('Widget props (e.g. skin, timeRange)')
  })
  .openapi({ 
    ref: 'PutUserWidgetOptions',
    description: 'Update widget props. The userWidgetUuid is provided in the URL path.'
  })

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

  // DELETE /user-widget/:userWidgetUuid
export const deleteUserWidgetSchema = z
  .object({})
  .openapi({ 
    ref: 'DeleteUserWidgetOptions',
    description: 'Delete a user widget. The userWidgetUuid is provided in the URL path.'
  })

// PUT /user-widgets-position
export const putUserWidgetsPositionSchema = z
  .object({
    widgets: z.array(
      z.object({
        usersHasWidgetsUuid: z.string().uuid().describe('UUID de users_has_widgets'),
        position: z.number().int().min(0).describe('Nueva posición del widget')
      })
    )
  })
  .openapi({ ref: 'PutUserWidgetsPositionOptions' })

export const putUserWidgetsPositionResponseSchema = z
  .object({
    success: z.boolean(),
    error: z.string().optional(),
    details: z.string().optional()
  })
  .openapi({ ref: 'PutUserWidgetsPositionResponse' })
