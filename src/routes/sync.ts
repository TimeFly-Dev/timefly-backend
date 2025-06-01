import { Hono } from 'hono'
import type { Context } from 'hono'
import { describeRoute } from 'hono-openapi'
import { validator as zValidator } from 'hono-openapi/zod'
import { syncDataSchema, syncResponseSchema } from '../validations/syncValidations'
import { syncTimeEntries, logSyncEvent } from '../services/syncService'
import { apiKeyAuthMiddleware } from '../middleware/apiKeyAuthMiddleware.ts'
import { logger } from '../utils/logger'

const sync = new Hono()

// Use API key authentication for sync endpoints
sync.use('*', apiKeyAuthMiddleware)

sync.post(
	'/',
	describeRoute({
		description: 'Synchronize time tracking pulses with the server',
		tags: ['Synchronization'],
		security: [{ apiKeyAuthMiddleware: [] }],
		requestBody: {
			description: 'Time tracking pulses to synchronize',
			required: true,
			content: {
				'application/json': {
					schema: {
						$ref: '#/components/schemas/SyncData'
					},
					example: {
						data: [
							{
								entity: 'src/main.ts',
								type: 'file',
								state: 'coding',
								time: 1647123456789,
								project: 'my-project',
								language: 'typescript',
								machine_name_id: 'machine-1',
								lines: 100,
								is_write: true
							}
						],
						start: '2024-03-01T00:00:00Z',
						end: '2024-03-02T00:00:00Z',
						timezone: 'UTC'
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Synchronization successful',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/SyncResponse'
						},
						example: {
							success: true,
							message: 'Successfully synchronized 2 entries (1 pulses, 1 aggregated).',
							syncedCount: 2
						}
					}
				}
			},
			207: {
				description: 'Partial success - some entries synchronized with errors',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/SyncResponse'
						},
						example: {
							success: true,
							message: 'Synchronized 2 entries with 1 error.',
							syncedCount: 2,
							errors: ['Invalid time format for pulse #3']
						}
					}
				}
			},
			400: {
				description: 'Invalid request data',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/SyncResponse'
						},
						example: {
							success: false,
							message: 'Invalid request data',
							errors: ['Missing required field: timezone']
						}
					}
				}
			},
			401: {
				description: 'Unauthorized - Invalid or missing API key',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/SyncResponse'
						},
						example: {
							success: false,
							message: 'Unauthorized',
							errors: ['Invalid API key']
						}
					}
				}
			},
			429: {
				description: 'Too many requests - Rate limit exceeded',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/SyncResponse'
						},
						example: {
							success: false,
							message: 'Rate limit exceeded',
							errors: ['Please wait before making more requests']
						}
					}
				}
			},
			500: {
				description: 'Server error',
				content: {
					'application/json': {
						schema: {
							$ref: '#/components/schemas/SyncResponse'
						},
						example: {
							success: false,
							message: 'Failed to synchronize time entries.',
							errors: ['Internal server error']
						}
					}
				}
			}
		},
		externalDocs: {
			description: 'API Documentation',
			url: 'https://docs.timefly.com/api/sync'
		}
	}),
	zValidator('json', syncDataSchema),
	async (c: Context) => {
		const userId = c.get('userId') as number
		const syncData = await c.req.json()
		const startTime = Date.now()
		const requestId = crypto.randomUUID()

		logger.info(`Starting sync for user ${userId}`, {
			requestId,
			pulsesCount: syncData.data?.length || 0,
			timezone: syncData.timezone
		})

		try {
			const { pulsesCount, aggregatedPulsesCount, errors } = await syncTimeEntries(userId, syncData)
			const endTime = Date.now()
			const syncDuration = endTime - startTime
			const totalCount = pulsesCount + aggregatedPulsesCount

			// Log sync event with detailed metrics
			await logSyncEvent(
				userId,
				pulsesCount,
				aggregatedPulsesCount,
				syncDuration,
				errors.length === 0,
				errors.join('; '),
				{
					requestId,
					timezone: syncData.timezone,
					userAgent: c.req.header('user-agent'),
					ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
				}
			)

			logger.info(`Sync completed for user ${userId}`, {
				requestId,
				totalCount,
				pulsesCount,
				aggregatedPulsesCount,
				errorsCount: errors.length,
				duration: syncDuration
			})

			if (errors.length > 0) {
				return c.json(
					{
						success: true,
						message: `Synchronized ${totalCount} entries with ${errors.length} errors.`,
						syncedCount: totalCount,
						errors,
						requestId
					},
					errors.length === totalCount ? 500 : 207
				)
			}

			return c.json({
				success: true,
				message: `Successfully synchronized ${totalCount} entries (${pulsesCount} pulses, ${aggregatedPulsesCount} aggregated).`,
				syncedCount: totalCount,
				requestId
			})
		} catch (error) {
			console.error('Sync error:', error)

			const endTime = Date.now()
			const syncDuration = endTime - startTime
			const errorMessage = (error as Error).message

			// Log sync event with error details
			await logSyncEvent(
				userId,
				0,
				0,
				syncDuration,
				false,
				errorMessage,
				{
					requestId,
					timezone: syncData.timezone,
					userAgent: c.req.header('user-agent'),
					ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
				}
			)

			logger.error(`Sync failed for user ${userId}`, {
				requestId,
				error: errorMessage,
				duration: syncDuration
			})

			return c.json(
				{
					success: false,
					message: 'Failed to synchronize time entries.',
					errors: [errorMessage],
					requestId
				},
				500
			)
		}
	}
)

export { sync }
