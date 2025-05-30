import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { getCodingTime, getTop3, getPulses } from '../services/statsService'
import { cookieAuthMiddleware } from '../middleware/cookieAuthMiddleware'
import {
	codingTimeSchema,
	codingTimeResponseSchema,
	topLanguagesSchema,
	topLanguagesResponseSchema,
	pulsesSchema,
	pulsesResponseSchema
} from '../validations/statsValidations'
import type { AggregationType } from '../types/stats'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'

const stats = new Hono()

stats.use('*', cookieAuthMiddleware)

stats.get(
	'/coding-time',
	describeRoute({
		description: 'Get coding time statistics for a user',
		tags: ['Statistics'],
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: 'Successful response',
				content: {
					'application/json': {
						schema: resolver(codingTimeResponseSchema)
					}
				}
			}
		}
	}),
	zValidator('query', codingTimeSchema),
	async (c) => {
		const userId = c.get('userId')
		const { startDate, endDate, aggregation } = c.req.valid('query')

		try {
			const codingTime = await getCodingTime({
				userId,
				startDate,
				endDate,
				aggregation: aggregation as AggregationType
			})
			return c.json({ success: true, data: { codingTime } })
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
		const { startDate, endDate, period } = c.req.valid('query')

		try {
			const topLanguages = await getTop3({
				userId,
				startDate,
				endDate,
				timeRange: period,
				entity: 'languages'
			})
			return c.json({ success: true, data: { topLanguages } })
		} catch (error) {
			console.error('Error fetching top languages:', error)
			return c.json({ success: false, error: 'Failed to fetch top languages' }, 500)
		}
	}
)

stats.get(
	'/pulses',
	describeRoute({
		description: 'Get pulses from aggregated_pulses for a user from the last day, week, or month',
		tags: ['Statistics'],
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: 'Successful response',
				content: {
					'application/json': {
						schema: resolver(pulsesResponseSchema)
					}
				}
			}
		}
	}),
	zValidator('query', pulsesSchema),
	async (c) => {
		const userId = c.get('userId')
		const { startDate, endDate, timeRange, responseFormat } = c.req.valid('query')

		try {
			const pulses = await getPulses({
				userId,
				startDate,
				endDate,
				timeRange,
				responseFormat
			})
			return c.json({ success: true, data: { pulses } })
		} catch (error) {
			console.error('Error fetching pulses:', error)
			return c.json({ success: false, error: 'Failed to fetch pulses' }, 500)
		}
	}
)

export { stats }
