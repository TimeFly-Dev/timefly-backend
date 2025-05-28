import { z } from 'zod'
import 'zod-openapi/extend'

export const codingTimeSchema = z
	.object({
		startDate: z.string().optional().describe('Start date for the range (YYYY-MM-DD)'),
		endDate: z.string().optional().describe('End date for the range (YYYY-MM-DD)'),
		aggregation: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'total']).describe('Type of aggregation for the stats')
	})
	.openapi({ ref: 'codingTimeOptions' })

export const codingTimeResponseSchema = z
	.object({
		success: z.boolean(),
		data: z.object({
			codingTime: z.array(
				z.object({
					date: z.string(),
					hours: z.number()
				})
			)
		})
	})
	.openapi({ ref: 'codingTimeResponse' })

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

export const pulsesSchema = z
	.object({
		startDate: z.string().optional().describe('Start date for the range (YYYY-MM-DD)'),
		endDate: z.string().optional().describe('End date for the range (YYYY-MM-DD)'),
		timeRange: z.enum(['day', 'week', 'month']).describe('Time range for fetching pulses (last day, week, or month)'),
		responseFormat: z.enum(['default', 'dashboard']).optional().default('default').describe('Format of the response')
	})
	.openapi({ ref: 'PulsesOptions' })

export const pulsesResponseSchema = z
	.object({
		success: z.boolean(),
		data: z.object({
			pulses: z.array(
				z.object({
					date: z.string(),
					project: z.string(),
					language: z.string(),
					duration: z.number(),
					start_time: z.string(),
					end_time: z.string()
				})
			)
		})
	})
	.openapi({ ref: 'PulsesResponse' })
