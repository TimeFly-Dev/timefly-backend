import { z } from 'zod'
import 'zod-openapi/extend'

export const codingStatsSchema = z
	.object({
		startDate: z.string().optional().describe('Start date for the range (YYYY-MM-DD)'),
		endDate: z.string().optional().describe('End date for the range (YYYY-MM-DD)'),
		date: z.string().optional().describe('Specific date for daily stats (YYYY-MM-DD)'),
		aggregation: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'total']).describe('Type of aggregation for the stats')
	})
	.openapi({ ref: 'CodingStatsOptions' })

export const codingStatsResponseSchema = z
	.object({
		success: z.boolean(),
		data: z.object({
			codingHours: z.array(
				z.object({
					date: z.string(),
					hours: z.string()
				})
			)
		})
	})
	.openapi({ ref: 'CodingStatsResponse' })
