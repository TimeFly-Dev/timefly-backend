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

export const totalTimeSchema = z
  .object({})
  .openapi({ ref: 'TotalTimeOptions' })

export const totalTimeResponseSchema = z
  .object({
    data: z.object({
      totalTime: z.number().describe('Total time in minutes'),
      totalTimeInDays: z.number().describe('Total time in days'),
      totalTimeInMonths: z.number().describe('Total time in months'),
      totalTimeInYears: z.number().describe('Total time in years')
    })
  })
  .openapi({ ref: 'TotalTimeResponse' })

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