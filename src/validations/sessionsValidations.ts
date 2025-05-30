import { z } from 'zod'
import 'zod-openapi/extend'

/**
 * Schema for session response
 */
export const sessionResponseSchema = z
	.object({
		success: z.boolean().describe('Indicates if the operation was successful'),
		data: z
			.object({
				sessions: z
					.array(
						z.object({
							id: z.string(),
							device_name: z.string(),
							device_type: z.string(),
							browser: z.string(),
							os: z.string(),
							ip_address: z.string(),
							last_active: z.string(),
							created_at: z.string()
						})
					)
					.describe('Array of user sessions'),
				currentSession: z.string().nullable().describe('ID of the current session')
			})
			.describe('Session data'),
		error: z.string().optional().describe('Error message if operation failed')
	})
	.openapi({ ref: 'SessionResponse' })

/**
 * Schema for session stats query parameters
 */
export const sessionStatsQuerySchema = z.object({
	startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	limit: z.number().int().min(1).max(100).optional()
})

/**
 * Schema for session revocation response
 */
export const sessionRevocationResponseSchema = z
	.object({
		success: z.boolean().describe('Indicates if the operation was successful'),
		data: z
			.object({
				revokedCount: z.number().optional().describe('Number of sessions revoked')
			})
			.optional(),
		message: z.string().optional().describe('Success message'),
		error: z.string().optional().describe('Error message if operation failed')
	})
	.openapi({ ref: 'SessionRevocationResponse' }) 