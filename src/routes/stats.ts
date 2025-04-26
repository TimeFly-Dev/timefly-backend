import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { getCodingStats, getTopLanguages } from '../services/statsService'
import { jwtAuthMiddleware } from '../middleware/jwtAuthMiddleware'
import {
	codingStatsSchema,
	codingStatsResponseSchema,
	topLanguagesSchema,
	topLanguagesResponseSchema
} from '../validations/statsValidations'
import type { AggregationType } from '../types/stats'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'

const stats = new Hono()

stats.use('*', jwtAuthMiddleware)

stats.get(
	'/coding-hours',
	describeRoute({
		description: 'Get coding hours statistics for a user',
		tags: ['Statistics'],
		security: [{ bearerAuth: [] }],
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
		const { startDate, endDate, aggregation } = c.req.valid('query')

		try {
			const codingHours = await getCodingStats({
				userId,
				startDate,
				endDate,
				aggregation: aggregation as AggregationType
			})
			return c.json({ success: true, data: { codingHours } })
		} catch (error) {
			console.error('Error fetching coding hours:', error)
			return c.json({ success: false, error: 'Failed to fetch coding hours' }, 500)
		}
	}
)

stats.get(
	'/top-languages',
	describeRoute({
		description: 'Get top programming languages statistics for a user',
		tags: ['Statistics'],
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: 'Successful response',
				content: {
					'application/json': {
						schema: resolver(topLanguagesResponseSchema)
					}
				}
			}
		}
	}),
	zValidator('query', topLanguagesSchema),
	async (c) => {
		const userId = c.get('userId')
		const { startDate, endDate, limit, period } = c.req.valid('query')

		try {
			const topLanguages = await getTopLanguages({
				userId,
				startDate,
				endDate,
				limit,
				period
			})
			return c.json({ success: true, data: { topLanguages } })
		} catch (error) {
			console.error('Error fetching top languages:', error)
			return c.json({ success: false, error: 'Failed to fetch top languages' }, 500)
		}
	}
)

export { stats }
