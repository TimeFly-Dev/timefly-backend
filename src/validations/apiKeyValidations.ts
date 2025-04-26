import { z } from 'zod'
import 'zod-openapi/extend'

export const apiKeyResponseSchema = z
	.object({
		success: z.boolean().describe('Indicates if the operation was successful'),
		data: z
			.object({
				apiKey: z.string().describe('The API key')
			})
			.optional(),
		error: z.string().optional().describe('Error message if operation failed')
	})
	.openapi({ ref: 'ApiKeyResponse' })
