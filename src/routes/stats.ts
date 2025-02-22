import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { getCodingStats } from '../services/statsService'
import { authMiddleware } from '../middleware/auth'
import { codingStatsSchema, codingStatsResponseSchema } from '../validations/statsValidations'
import type { AggregationType } from '../types/stats'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'

const stats = new Hono()

stats.use('*', authMiddleware)

stats.get(
	'/coding-hours',
	describeRoute({
		description: 'Get coding hours statistics for a user',
		tags: ['Statistics'],
		responses: {
			200: {
				description: 'Successful response',
				content: {
					'application/json': {
						schema: resolver(codingStatsResponseSchema)
					}
				}
			}
		}
	}),
	zValidator('query', codingStatsSchema),
	async (c) => {
		const userId = c.get('userId')
		const { startDate, endDate, date, aggregation } = c.req.valid('query')

		try {
			const codingHours = await getCodingStats({
				userId,
				startDate,
				endDate,
				date,
				aggregation: aggregation as AggregationType
			})
			return c.json({ success: true, data: { codingHours } })
		} catch (error) {
			console.error('Error fetching coding hours:', error)
			return c.json({ success: false, error: 'Failed to fetch coding hours' }, 500)
		}
	}
)

export { stats }
