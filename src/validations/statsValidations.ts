import { z } from 'zod'
import 'zod-openapi/extend'

export const codingStatsSchema = z
	.object({
		startDate: z.string().optional().describe('Start date for the range (YYYY-MM-DD)'),
		endDate: z.string().optional().describe('End date for the range (YYYY-MM-DD)'),
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
					hours: z.number()
				})
			)
		})
	})
	.openapi({ ref: 'CodingStatsResponse' })

export const topLanguagesSchema = z
	.object({
		startDate: z.string().optional().describe('Start date for the range (YYYY-MM-DD)'),
		endDate: z.string().optional().describe('End date for the range (YYYY-MM-DD)'),
		limit: z.number().min(1).max(100).optional().describe('Number of top languages to return'),
		period: z.enum(['day', 'week', 'month', 'year', 'all']).optional().describe('Period for the top languages')
	})
	.openapi({ ref: 'TopLanguagesOptions' })

export const topLanguagesResponseSchema = z
	.object({
		success: z.boolean(),
		data: z.object({
			topLanguages: z.array(
				z.object({
					language: z.string(),
					hours: z.string(),
					lastUsed: z.string(),
					lastProject: z.string()
				})
			)
		})
	})
	.openapi({ ref: 'TopLanguagesResponse' })
