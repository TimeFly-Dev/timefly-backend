import { z } from 'zod'
import 'zod-openapi/extend'

export const todaysActivitySchema = z
  .object({
    date: z.string().optional().describe('Date for the activity (YYYY-MM-DD)')
  })
  .openapi({ ref: 'TodaysActivityOptions' })

export const todaysActivityResponseSchema = z
  .object({
    data: z.object({
      computed: z.object({
        reading: z.number(),
        coding: z.number(),
        debbuging: z.number()
      }),
      timeline: z.array(
        z.object({
          start: z.string(),
          end: z.string(),
          project: z.string(),
          time: z.number()
        })
      )
    })
  })
  .openapi({ ref: 'TodaysActivityResponse' })

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