import { z } from 'zod'
import 'zod-openapi/extend'

export const exportRequestSchema = z
	.object({
		email: z.string().email().describe('Email where the export will be sent'),
		startDate: z.string().optional().describe('Start date for the export range (YYYY-MM-DD)'),
		endDate: z.string().optional().describe('End date for the export range (YYYY-MM-DD)')
	})
	.openapi({ ref: 'ExportRequest' })

export const exportResponseSchema = z
	.object({
		success: z.boolean(),
		message: z.string().optional(),
		error: z.string().optional()
	})
	.openapi({ ref: 'ExportResponse' })

export const downloadRequestSchema = z
	.object({
		filename: z
			.string()
			.regex(/^user-\d+.*\.json$/, 'Invalid filename format')
			.describe('The filename of the export to download')
	})
	.openapi({ ref: 'DownloadRequest' })

export const downloadResponseSchema = z
	.object({
		success: z.boolean(),
		message: z.string().optional(),
		error: z.string().optional(),
		data: z
			.array(
				z.object({
					filename: z.string(),
					url: z.string(),
					createdAt: z.string()
				})
			)
			.optional()
	})
	.openapi({ ref: 'DownloadResponse' })
