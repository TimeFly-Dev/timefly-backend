import { Hono } from 'hono'
import type { Context } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi/zod'
import { syncDataSchema, syncResponseSchema } from '@/validations/syncValidations'
import { syncTimeEntries, logSyncEvent } from '@/services/syncService'
import { authMiddleware } from '@/middleware/auth'

const sync = new Hono()

sync.use('*', authMiddleware)

sync.post(
	'/',
	describeRoute({
		description: 'Synchronize time entries',
		tags: ['Synchronization'],
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
			await syncTimeEntries(userId, syncData.data)
			const endTime = Date.now()
			const syncDuration = endTime - startTime

			await logSyncEvent(userId, syncData.data.length, syncDuration, true)

			return c.json({
				success: true,
				message: `Successfully synchronized ${syncData.data.length} time entries.`
			})
		} catch (error) {
			console.error('Sync error:', error)

			const endTime = Date.now()
			const syncDuration = endTime - startTime
			await logSyncEvent(userId, syncData.data.length, syncDuration, false, (error as Error).message)

			return c.json(
				{
					success: false,
					message: 'Failed to synchronize time entries.'
				},
				500
			)
		}
	}
)

export { sync }
