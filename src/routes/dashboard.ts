import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { jwtAuthMiddleware } from '../middleware/jwtAuthMiddleware'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'
import { z } from 'zod'
import {
	widgetsResponseSchema,
	userWidgetsSchema,
	userWidgetsResponseSchema,
	postUserWidgetSchema,
	postUserWidgetResponseSchema,
	putUserWidgetSchema,
	putUserWidgetResponseSchema,
	deleteUserWidgetSchema,
	putUserWidgetsPositionSchema,
	putUserWidgetsPositionResponseSchema
} from '../validations/widgetValidations'
import { getWidgets, getUserWidgets, postUserWidget, updateUserWidget, deleteUserWidget, updateUserWidgetsPosition } from '@/services/widgetsService'
import { getTodaysActivity } from '@/services/dashboardService'

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
			},
			500: {
				description: 'Internal Server Error',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								success: { type: 'boolean' },
								error: { type: 'string' },
								details: { type: 'string' }
							}
						}
					}
				}
			}
		}
	}),
	async (c) => {
		try {
			const widgets = await getWidgets()
			return c.json({ data: widgets })
		} catch (error) {
			console.error('Error fetching widgets:', error)
			return c.json(
				{
					success: false,
					error: 'Failed to fetch widgets',
					details: error instanceof Error ? error.message : 'Unknown error'
				},
				500
			)
		}
	}
)

dashboard.get(
	'/user-widgets',
	describeRoute({
		description: "Get a user's widgets with their data",
		tags: ['Dashboard'],
		parameters: [
			{
				name: 'userUuid',
				in: 'query',
				description: 'UUID of the user',
				required: true,
				schema: { type: 'string' }
			}
		],
		responses: {
			200: {
				description: 'Successful response',
				content: {
					'application/json': {
						schema: resolver(userWidgetsResponseSchema)
					}
				}
			},
			400: {
				description: 'Bad request',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								success: { type: 'boolean' },
								error: { type: 'string' },
								details: { type: 'string' }
							}
						}
					}
				}
			},
			404: {
				description: 'Not found',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								success: { type: 'boolean' },
								error: { type: 'string' },
								details: { type: 'string' }
							}
						}
					}
				}
			},
			500: {
				description: 'Internal Server Error',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								success: { type: 'boolean' },
								error: { type: 'string' },
								details: { type: 'string' }
							}
						}
					}
				}
			}
		}
	}),
	zValidator('query', userWidgetsSchema),
	async (c) => {
		try {
			const { userUuid } = c.req.valid('query')
			const widgets = await getUserWidgets(userUuid)
			return c.json({ data: widgets })
		} catch (error) {
			console.error('Error fetching user widgets:', error)
			const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500
			return c.json(
				{
					success: false,
					error: 'Failed to fetch user widgets',
					details: error instanceof Error ? error.message : 'Unknown error'
				},
				statusCode
			)
		}
	}
)

dashboard.post(
	'/user-widget',
	describeRoute({
		description: "Insert a users_has_widgets record",
		tags: ['Dashboard'],
		responses: {
			200: {
				description: 'Successful response',
				content: {
					'application/json': {
						schema: resolver(postUserWidgetResponseSchema)
					}
				}
			},
			400: {
				description: 'Bad request',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								success: { type: 'boolean' },
								error: { type: 'string' },
								details: { type: 'string' }
							}
						}
					}
				}
			},
			500: {
				description: 'Internal Server Error',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								success: { type: 'boolean' },
								error: { type: 'string' },
								details: { type: 'string' }
							}
						}
					}
				}
			}
		}
	}),
	zValidator('json', postUserWidgetSchema),
	async (c) => {
		try {
			const response = await postUserWidget(await c.req.json())
			return c.json({ data: [response] })
		} catch (error) {
			console.error('Error creating user widget:', error)
			return c.json(
				{
					success: false,
					error: 'Failed to create user widget',
					details: error instanceof Error ? error.message : 'Unknown error'
				},
				500
			)
		}
	}
)

dashboard.put(
	'/user-widget/:userWidgetUuid',
	describeRoute({
		description: "Update a user's widget props",
		tags: ['Dashboard'],
		parameters: [
			{
				name: 'userWidgetUuid',
				in: 'path',
				description: 'UUID of the user widget to update',
				required: true,
				schema: { type: 'string' }
			}
		],
		request: {
			content: {
				'application/json': {
					schema: resolver(putUserWidgetSchema)
				}
			}
		},
		responses: {
			200: {
				description: 'Successful response',
				content: {
					'application/json': {
						schema: resolver(putUserWidgetResponseSchema)
					}
				}
			},
			400: {
				description: 'Bad request',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								success: { type: 'boolean' },
								error: { type: 'string' },
								details: { type: 'string' }
							}
						}
					}
				}
			},
			404: {
				description: 'Not found',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								success: { type: 'boolean' },
								error: { type: 'string' },
								details: { type: 'string' }
							}
						}
					}
				}
			},
			500: {
				description: 'Internal Server Error',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								success: { type: 'boolean' },
								error: { type: 'string' },
								details: { type: 'string' }
							}
						}
					}
				}
			}
		}
	}),
	zValidator('json', putUserWidgetSchema),
	async (c) => {
		try {
			const { userWidgetUuid } = c.req.param()
			const { props } = await c.req.valid('json')
			const response = await updateUserWidget(userWidgetUuid, props)
			return c.json({ data: [response] })
		} catch (error) {
			console.error('Error updating user widget:', error)
			const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500
			return c.json(
				{
					success: false,
					error: 'Failed to update user widget',
					details: error instanceof Error ? error.message : 'Unknown error'
				},
				statusCode
			)
		}
	}
)

dashboard.delete(
  '/user-widget/:userWidgetUuid',
  describeRoute({
    description: "Delete a user's widget",
    tags: ['Dashboard'],
    parameters: [
      {
        name: 'userWidgetUuid',
        in: 'path',
        description: 'UUID of the user widget to delete',
        required: true,
        schema: { type: 'string' }
      }
    ],
    responses: {
      204: {
        description: 'Widget deleted successfully'
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                error: { type: 'string' },
                details: { type: 'string' }
              }
            }
          }
        }
      },
      404: {
        description: 'Not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                error: { type: 'string' },
                details: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }),
  zValidator('param', z.object({
    userWidgetUuid: z.string().uuid()
  })),
  async (c) => {
    try {
      const { userWidgetUuid } = c.req.valid('param')
      const deleted = await deleteUserWidget(userWidgetUuid)

      if (!deleted) {
        return c.json(
          {
            success: false,
            error: 'User widget not found',
            details: `No widget found with UUID: ${userWidgetUuid}`
          },
          404
        )
      }

      return new Response(null, { status: 204 })
    } catch (error) {
      console.error('Error deleting user widget:', error)
      return c.json(
        {
          success: false,
          error: 'Failed to delete user widget',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        500
      )
    }
  }
)


dashboard.get(
	'/todays-activity',
	describeRoute({
		description: "Get today's coding activity timeline",
		tags: ['Dashboard'],
		responses: {
			200: {
				description: 'Successful response with today\'s activity timeline',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								data: {
									type: 'object',
									properties: {
										timeline: {
											type: 'array',
											items: {
												type: 'object',
												properties: {
													start: { type: 'string', format: 'date-time' },
													end: { type: 'string', format: 'date-time' },
													project: { type: 'string' },
													time: { type: 'number' }
												},
												required: ['start', 'end', 'project', 'time']
											}
										}
									}
								}
							}
						}
					}
				}
			},
			500: {
				description: 'Internal Server Error',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								success: { type: 'boolean' },
								error: { type: 'string' },
								details: { type: 'string' }
							}
						}
					}
				}
			}
		}
	}),
	async (c) => {
		try {
			// TODO: Get the actual user ID from the auth token
			const userId = 1; // Replace with actual user ID from auth
			const activity = await getTodaysActivity(userId);
			return c.json(activity);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('Error fetching today\'s activity:', error);
			return c.json(
				{ success: false, error: 'Failed to fetch activity', details: errorMessage },
				500
			);
		}
	}
)

dashboard.put(
  '/user-widgets-position',
  zValidator(
    'json',
    putUserWidgetsPositionSchema
  ),
  async (c) => {
    try {
      const { widgets } = c.req.valid('json')
      await updateUserWidgetsPosition(widgets)
      return c.json({ success: true })
    } catch (error) {
      console.error('Error updating widgets position:', error)
      return c.json({
        success: false,
        error: 'Failed to update widgets position',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  }
)

export { dashboard }
