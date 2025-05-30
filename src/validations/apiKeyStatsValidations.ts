import { z } from 'zod'
import 'zod-openapi/extend'

/**
 * Schema for API key statistics response
 */
export const apiKeyStatsResponseSchema = z
	.object({
		success: z.boolean().describe('Indicates if the operation was successful'),
		data: z
			.object({
				stats: z
					.array(
						z.object({
							user_id: z.number(),
							date: z.string(),
							event_type: z.union([z.number(), z.string()]),
							event_count: z.union([z.number(), z.string()])
						})
					)
					.describe('Array of daily API key event statistics'),
				totalCreated: z.number().describe('Total number of API keys created'),
				totalRegenerated: z.number().describe('Total number of API keys regenerated')
			})
			.optional(),
		error: z.string().optional().describe('Error message if operation failed')
	})
	.openapi({ ref: 'ApiKeyStatsResponse' })

/**
 * Schema for API key stats query parameters
 */
export const apiKeyStatsQuerySchema = z.object({
	startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	limit: z.number().int().min(1).max(100).optional()
}) 