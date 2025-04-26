import { Hono } from 'hono'
import type { Context } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi/zod'
import { syncDataSchema, syncResponseSchema } from '../validations/syncValidations'
import { syncTimeEntries, logSyncEvent } from '../services/syncService'
import { apiKeyAuthMiddleware } from '../middleware/apiKeyAuthMiddleware.ts'

const sync = new Hono()

// Use API key authentication for sync endpoints
sync.use('*', apiKeyAuthMiddleware)

sync.post(
	'/',
	describeRoute({
		description: 'Synchronize time tracking pulses',
		tags: ['Synchronization'],
		security: [{ apiKeyAuthMiddleware: [] }],
		responses: {
			200: {
				description: 'Synchronization successful',
				content: {
					'application/json': {
						schema: resolver(syncResponseSchema)
					}
				}
			},
			400: {
				description: 'Invalid request data',
				content: {
					'application/json': {
						schema: resolver(syncResponseSchema)
					}
				}
			},
			401: {
				description: 'Unauthorized',
				content: {
					'application/json': {
						schema: resolver(syncResponseSchema)
					}
				}
			},
			500: {
				description: 'Server error',
				content: {
					'application/json': {
						schema: resolver(syncResponseSchema)
					}
				}
			}
		}
	}),
	zValidator('json', syncDataSchema),
	async (c: Context) => {
		const userId = c.get('userId') as number
		const syncData = await c.req.json()
		const startTime = Date.now()

		try {
			const { pulsesCount, aggregatedPulsesCount, errors } = await syncTimeEntries(userId, syncData)
			const endTime = Date.now()
			const syncDuration = endTime - startTime
			const totalCount = pulsesCount + aggregatedPulsesCount

			await logSyncEvent(userId, pulsesCount, aggregatedPulsesCount, syncDuration, errors.length === 0, errors.join('; '))

			if (errors.length > 0) {
				return c.json(
					{
						success: true,
						message: `Synchronized ${totalCount} entries with ${errors.length} errors.`,
						syncedCount: totalCount,
						errors
					},
					errors.length === totalCount ? 500 : 207
				)
			}

			return c.json({
				success: true,
				message: `Successfully synchronized ${totalCount} entries (${pulsesCount} pulses, ${aggregatedPulsesCount} aggregated).`,
				syncedCount: totalCount
			})
		} catch (error) {
			console.error('Sync error:', error)

			const endTime = Date.now()
			const syncDuration = endTime - startTime
			const errorMessage = (error as Error).message

			await logSyncEvent(userId, 0, 0, syncDuration, false, errorMessage)

			return c.json(
				{
					success: false,
					message: 'Failed to synchronize time entries.',
					errors: [errorMessage]
				},
				500
			)
		}
	}
)

export { sync }
