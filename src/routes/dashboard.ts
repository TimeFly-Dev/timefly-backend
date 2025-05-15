import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { jwtAuthMiddleware } from '../middleware/jwtAuthMiddleware'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'
import { z } from 'zod'
import {
	widgetsSchema,
	widgetsResponseSchema,
	userWidgetsSchema,
	userWidgetsResponseSchema,
	mostActiveWeekdaySchema,
	mostActiveWeekdayResponseSchema,
	topItemsSchema,
	topItemsResponseSchema
} from '../validations/widgetValidations'
import { getWidgets, getUserWidgets } from '@/services/widgetsService'

const dashboard = new Hono()

// Replace by new Cookies middleware
// dashboard.use('*', jwtAuthMiddleware)

dashboard.get(
	'/widgets',
	describeRoute({
		description: 'Get all available widgets',
		tags: ['Dashboard'],
		responses: {
			200: {
				description: 'Successful response',
				content: {
					'application/json': {
						schema: resolver(widgetsResponseSchema)
					}
				}
			}
		}
	}),
	// zValidator('query', widgetsSchema),
	async (c) => {
		try {
			const widgets = await getWidgets()
			return c.json({ data: widgets })
		} catch (error) {
			console.error("Error in GET /widgets:", error)
			return c.json({ data: { error: "Failed to fetch widgets" }}, 500)
		}
	}
)

dashboard.get(
	'/user-widgets',
	describeRoute({
		description: "Get user's widget definition. Returns the widgets plus the fetched data from each widget query",
		tags: ['Dashboard'],
		responses: {
			200: {
				description: 'Successful response',
				content: {
					'application/json': {
						schema: resolver(userWidgetsResponseSchema)
					}
				}
			}
		}
	}),
	zValidator('query', userWidgetsSchema),
	async (c) => {
		try {
			const response = await getUserWidgets(c.req.query("userUuid"))

			return c.json({
				data: response
			})
		} catch (error) {
			console.error('Error fetching user widgets:', error)
			return c.json(
				{
					data: {
						error: 'Failed to fetch user widgets'
					}
				},
				500
			)
		}
	}
)

export { dashboard }
