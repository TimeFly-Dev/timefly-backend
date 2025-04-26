import { Hono } from 'hono'
import path from 'node:path'
import fs from 'node:fs/promises'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi/zod'
import { exportRequestSchema, downloadRequestSchema, exportResponseSchema, downloadResponseSchema } from '@/validations/exportValidations'
import { jwtAuthMiddleware } from '@/middleware/jwtAuthMiddleware'
import { CONFIG } from '@/config'

const exports = new Hono()

exports.use('*', jwtAuthMiddleware)

const EXPORT_DIR = path.join(process.cwd(), 'exports')

// Ensure export directory exists
try {
	fs.access(EXPORT_DIR).catch(() => {
		fs.mkdir(EXPORT_DIR, { recursive: true })
	})
} catch (error) {
	console.error('Error checking/creating export directory:', error)
}

exports.post(
	'/create',
	describeRoute({
		description: 'Create a new export of user time entries',
		tags: ['Exports'],
		responses: {
			202: {
				description: 'Export job started successfully',
				content: {
					'application/json': {
						schema: resolver(exportResponseSchema)
					}
				}
			},
			400: {
				description: 'Invalid request data',
				content: {
					'application/json': {
						schema: resolver(exportResponseSchema)
					}
				}
			},
			401: {
				description: 'Unauthorized',
				content: {
					'application/json': {
						schema: resolver(exportResponseSchema)
					}
				}
			},
			500: {
				description: 'Server error',
				content: {
					'application/json': {
						schema: resolver(exportResponseSchema)
					}
				}
			}
		}
	}),
	zValidator('json', exportRequestSchema),
	async (c) => {
		const userId = c.get('userId') as number
		const { email, startDate, endDate } = await c.req.json()

		console.log(`[${new Date().toISOString()}] Starting export process for user ${userId}`)
		console.log(`Export details: email=${email}, startDate=${startDate}, endDate=${endDate}`)

		if (!CONFIG.RESEND_API_KEY) {
			console.error('RESEND_API_KEY is not set. Export cannot proceed.')
			return c.json(
				{
					success: false,
					error: 'Export service is not properly configured.'
				},
				500
			)
		}

		try {
			const worker = new Worker('./src/workers/export-worker.ts', {
				smol: true // Use less memory since this is a background task
			})

			console.log(`[${new Date().toISOString()}] Worker created for user ${userId}`)

			worker.postMessage({ userId, email, startDate, endDate })

			worker.addEventListener('message', (event) => {
				const message = event.data
				switch (message.type) {
					case 'progress':
						console.log(
							`[${new Date().toISOString()}] Export progress for user ${userId}: ${message.processed} entries processed`
						)
						break
					case 'complete':
						console.log(
							`[${new Date().toISOString()}] Export completed for user ${userId}: ${message.totalEntries} total entries`
						)
						worker.terminate()
						break
					case 'error':
						console.error(`[${new Date().toISOString()}] Export error for user ${userId}: ${message.error}`)
						worker.terminate()
						break
				}
			})

			worker.unref()

			console.log(`[${new Date().toISOString()}] Export job started for user ${userId}`)

			return c.json(
				{
					success: true,
					message: "Export started. You will receive an email when it's complete."
				},
				202
			)
		} catch (error) {
			console.error(`[${new Date().toISOString()}] Error starting export for user ${userId}:`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to start export'
				},
				500
			)
		}
	}
)

exports.get(
	'/download/:filename',
	describeRoute({
		description: 'Download an exported file',
		tags: ['Exports'],
		parameters: [
			{
				name: 'filename',
				in: 'path',
				required: true,
				schema: { type: 'string' },
				description: 'The filename of the export to download'
			}
		],
		responses: {
			200: {
				description: 'File download successful',
				content: {
					'application/json': {
						schema: resolver(downloadResponseSchema)
					}
				}
			},
			401: {
				description: 'Unauthorized',
				content: {
					'application/json': {
						schema: resolver(downloadResponseSchema)
					}
				}
			},
			403: {
				description: 'Forbidden - User does not own this export',
				content: {
					'application/json': {
						schema: resolver(downloadResponseSchema)
					}
				}
			},
			404: {
				description: 'File not found',
				content: {
					'application/json': {
						schema: resolver(downloadResponseSchema)
					}
				}
			}
		}
	}),
	zValidator('param', downloadRequestSchema),
	async (c) => {
		const userId = c.get('userId') as number
		const { filename } = c.req.valid('param')

		// Extract user ID from filename
		const fileUserIdMatch = filename.match(/^user-(\d+)/)
		if (!fileUserIdMatch) {
			return c.json(
				{
					success: false,
					error: 'Invalid file format'
				},
				400
			)
		}

		const fileUserId = Number.parseInt(fileUserIdMatch[1], 10)

		// Verify file ownership
		if (fileUserId !== userId) {
			return c.json(
				{
					success: false,
					error: 'You do not have permission to access this file'
				},
				403
			)
		}

		try {
			const filePath = path.join(EXPORT_DIR, filename)

			// Verify file exists and is within exports directory
			const normalizedFilePath = path.normalize(filePath)
			if (!normalizedFilePath.startsWith(EXPORT_DIR)) {
				return c.json(
					{
						success: false,
						error: 'Invalid file path'
					},
					400
				)
			}

			// Check if file exists
			try {
				await fs.access(filePath)
			} catch {
				return c.json(
					{
						success: false,
						error: 'File not found'
					},
					404
				)
			}

			// Read and serve the file
			const content = await fs.readFile(filePath)

			// Set appropriate headers
			return new Response(content, {
				headers: {
					'Content-Type': 'application/json',
					'Content-Disposition': `attachment; filename="${filename}"`,
					'Cache-Control': 'private, no-cache, no-store, must-revalidate',
					Pragma: 'no-cache',
					Expires: '0'
				}
			})
		} catch (error) {
			console.error('Error serving file:', error)
			return c.json(
				{
					success: false,
					error: 'Error serving file'
				},
				500
			)
		}
	}
)

// Optional: Add endpoint to list user's exports
exports.get(
	'/list',
	describeRoute({
		description: 'List user exports',
		tags: ['Exports'],
		responses: {
			200: {
				description: 'List of user exports',
				content: {
					'application/json': {
						schema: resolver(downloadResponseSchema)
					}
				}
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId') as number

		try {
			const files = await fs.readdir(EXPORT_DIR)
			const userFiles = files
				.filter((file) => file.startsWith(`user-${userId}`))
				.map((file) => {
					return {
						filename: file,
						url: `${CONFIG.BASE_URL}/exports/download/${file}`,
						createdAt: new Date(file.match(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)?.[0] || '').toISOString()
					}
				})
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

			return c.json({
				success: true,
				data: userFiles
			})
		} catch (error) {
			console.error('Error listing exports:', error)
			return c.json(
				{
					success: false,
					error: 'Error listing exports'
				},
				500
			)
		}
	}
)

// Optional: Add endpoint to delete an export
exports.delete(
	'/delete/:filename',
	describeRoute({
		description: 'Delete an export file',
		tags: ['Exports'],
		parameters: [
			{
				name: 'filename',
				in: 'path',
				required: true,
				schema: { type: 'string' },
				description: 'The filename of the export to delete'
			}
		],
		responses: {
			200: {
				description: 'File deleted successfully',
				content: {
					'application/json': {
						schema: resolver(downloadResponseSchema)
					}
				}
			}
		}
	}),
	zValidator('param', downloadRequestSchema),
	async (c) => {
		const userId = c.get('userId') as number
		const { filename } = c.req.valid('param')

		// Extract user ID from filename
		const fileUserIdMatch = filename.match(/^user-(\d+)/)
		if (!fileUserIdMatch) {
			return c.json(
				{
					success: false,
					error: 'Invalid file format'
				},
				400
			)
		}

		const fileUserId = Number.parseInt(fileUserIdMatch[1], 10)

		// Verify file ownership
		if (fileUserId !== userId) {
			return c.json(
				{
					success: false,
					error: 'You do not have permission to delete this file'
				},
				403
			)
		}

		try {
			const filePath = path.join(EXPORT_DIR, filename)

			// Verify file is within exports directory
			const normalizedFilePath = path.normalize(filePath)
			if (!normalizedFilePath.startsWith(EXPORT_DIR)) {
				return c.json(
					{
						success: false,
						error: 'Invalid file path'
					},
					400
				)
			}

			// Delete the file
			await fs.unlink(filePath)

			return c.json({
				success: true,
				message: 'File deleted successfully'
			})
		} catch (error) {
			console.error('Error deleting file:', error)
			return c.json(
				{
					success: false,
					error: 'Error deleting file'
				},
				500
			)
		}
	}
)

export { exports }
