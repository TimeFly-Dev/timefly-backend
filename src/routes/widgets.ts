import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'
import { z } from 'zod'
import {
  todaysActivitySchema,
  todaysActivityResponseSchema,
  totalTimeSchema,
  totalTimeResponseSchema,
  mostActiveWeekdaySchema,
  mostActiveWeekdayResponseSchema,
  topItemsSchema,
  topItemsResponseSchema
} from '../validations/widgetValidations'


const widgets = new Hono()

widgets.use('*', authMiddleware)

widgets.get(
  '/todays-activity',
  describeRoute({
    description: 'Get users today activity',
    tags: ['Widgets'],
    responses: {
      200: {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: resolver(todaysActivityResponseSchema)
          }
        }
      }
    }
  }),
  zValidator('query', todaysActivitySchema),
  async (c) => {
    // const userId = c.get('userId')
    // const { date } = c.req.valid('query')

    try {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 3600000)
      const twoHoursAgo = new Date(now.getTime() - 7200000)

      const hardcodedData = {
        data: {
          computed: {
            reading: 2000,
            coding: 140,
            debbuging: 543
          },
          timeline: [
            {
              start: twoHoursAgo.toISOString(),
              end: oneHourAgo.toISOString(),
              project: "timefly-backend",
              time: 59
            },
            {
              start: oneHourAgo.toISOString(),
              end: now.toISOString(),
              project: "timefly-frontend",
              time: 45
            }
          ]
        }
      }

      return c.json(hardcodedData)
    } catch (error) {
      console.error('Error fetching today\'s activity:', error)
      return c.json({
        data: {
          error: 'Failed to fetch today\'s activity'
        }
      }, 500)
    }
  }
)

widgets.get(
  '/total-time',
  describeRoute({
    description: 'Get user\'s total tracked time',
    tags: ['Widgets'],
    responses: {
      200: {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: resolver(totalTimeResponseSchema)
          }
        }
      }
    }
  }),
  zValidator('query', totalTimeSchema),
  async (c) => {
    // const userId = c.get('userId')

    try {
      const hardcodedData = {
        data: {
          totalTime: 39124.8,
          totalTimeInDays: 27.17,
          totalTimeInMonths: 0.89,
          totalTimeInYears: 0.07
        }
      }

      return c.json(hardcodedData)
    } catch (error) {
      console.error('Error fetching total time:', error)
      return c.json({
        data: {
          error: 'Failed to fetch total time'
        }
      }, 500)
    }
  }
)

widgets.get(
  '/most-active-weekday',
  describeRoute({
    description: 'Get user\'s most active weekday',
    tags: ['Widgets'],
    responses: {
      200: {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: resolver(mostActiveWeekdayResponseSchema)
          }
        }
      }
    }
  }),
  zValidator('query', mostActiveWeekdaySchema),
  async (c) => {
    // const userId = c.get('userId')
    // const { weeks } = c.req.valid('query')

    try {
      const hardcodedData = {
        data: {
          weekDay: "Monday",
          averageHoursWorked: 4
        }
      }

      return c.json(hardcodedData)
    } catch (error) {
      console.error('Error fetching most active weekday:', error)
      return c.json({
        data: {
          error: 'Failed to fetch most active weekday'
        }
      }, 500)
    }
  }
)

widgets.get(
  '/topItems/:item',
  describeRoute({
    description: 'Get top items by time spent',
    tags: ['Widgets'],
    parameters: [
      {
        name: 'item',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          enum: ['machines', 'projects', 'languages', 'operativeSystems', 'entities']
        }
      }
    ],
    responses: {
      200: {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: resolver(topItemsResponseSchema)
          }
        }
      },
      400: {
        description: 'Invalid item type'
      }
    }
  }),
  zValidator('param', topItemsSchema),
  zValidator('query', z.object({ limit: z.number().optional() }).strict()),
  async (c) => {
    // const userId = c.get('userId')
    const { item } = c.req.valid('param')
    const { limit = 5 } = c.req.valid('query')

    try {
      const hardcodedResponses = {
        machines: [
          { item: "MacBook Pro", time: 1240 },
          { item: "Dell XPS", time: 876 },
          { item: "ThinkPad X1", time: 543 }
        ],
        projects: [
          { item: "timefly-backend", time: 982 },
          { item: "timefly-frontend", time: 754 },
          { item: "data-analytics", time: 432 }
        ],
        languages: [
          { item: "TypeScript", time: 1320 },
          { item: "JavaScript", time: 860 },
          { item: "Python", time: 540 }
        ],
        operativeSystems: [
          { item: "Windows", time: 780 },
          { item: "MacOS", time: 1560 },
          { item: "Linux", time: 640 }
        ],
        entities: [
          { item: "Functions", time: 940 },
          { item: "Classes", time: 750 },
          { item: "Interfaces", time: 520 }
        ]
      }

      const responseData = hardcodedResponses[item] || []

      return c.json({
        data: responseData.slice(0, limit)
      })
    } catch (error) {
      console.error(`Error fetching top ${item}:`, error)
      return c.json({
        data: {
          error: `Failed to fetch top ${item}`
        }
      }, 500)
    }
  }
)

export { widgets }