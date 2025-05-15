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
        props: z.object({
          skin: z.string(),
          timeRange: z.string()
        }),
        widgetData: z.object({})
      })
    )
  })
  .openapi({ ref: 'UserWidgetsResponse' })









export const mostActiveWeekdaySchema = z
  .object({
    weeks: z.number().optional().describe('Number of weeks to consider for the calculation')
  })
  .openapi({ ref: 'MostActiveWeekdayOptions' })

export const mostActiveWeekdayResponseSchema = z
  .object({
    data: z.object({
      weekDay: z.string(),
      averageHoursWorked: z.number()
    })
  })
  .openapi({ ref: 'MostActiveWeekdayResponse' })

export const topItemsSchema = z
  .object({
    item: z.enum(['machines', 'projects', 'languages', 'operativeSystems', 'entities'])
      .describe('Item type for which to retrieve top entries'),
    limit: z.number().optional().default(5)
      .describe('Number of top items to return')
  })
  .openapi({ ref: 'TopItemsOptions' })

export const topItemsResponseSchema = z
  .object({
    data: z.array(
      z.object({
        item: z.string(),
        time: z.number()
      })
    )
  })
  .openapi({ ref: 'TopItemsResponse' })