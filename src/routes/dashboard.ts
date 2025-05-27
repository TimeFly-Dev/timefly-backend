import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { describeRoute } from 'hono-openapi'
import { cookieAuthMiddleware } from '../middleware/cookieAuthMiddleware'
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

const dashboard = new Hono()

// Replace by new Cookies middleware
dashboard.use('*', cookieAuthMiddleware)

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
		description: "Get all user's widgets with their widgetData (result of widgetQuery execution)",
		tags: ['Dashboard'],
		parameters: [
			{
				name: 'userId',
				in: 'query',
				description: 'ID of the user',
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
			const { userId } = c.req.valid('query')
			const widgets = await getUserWidgets(userId)
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
	'/user-widget/:userWidgetId',
	describeRoute({
		description: "Update a user's widget props",
		tags: ['Dashboard'],
		parameters: [
			{
				name: 'userWidgetId',
				in: 'path',
				description: 'ID of the user has widgets to update',
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
			const { userWidgetId } = c.req.param()
			const { props } = await c.req.valid('json')
			const response = await updateUserWidget(userWidgetId, props)
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
  '/user-widget/:userWidgetId',
  describeRoute({
    description: "Delete a user's widget",
    tags: ['Dashboard'],
    parameters: [
      {
        name: 'userWidgetId',
        in: 'path',
        description: 'ID of the user widget to delete',
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
    userWidgetId: z.string()
  })),
  async (c) => {
    try {
      const { userWidgetId } = c.req.valid('param')
      const deleted = await deleteUserWidget(userWidgetId)

      if (!deleted) {
        return c.json(
          {
            success: false,
            error: 'User widget not found',
            details: `No widget found with ID: ${userWidgetId}`
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

dashboard.put(
  '/user-widgets-position',
  zValidator(
    'json',
    putUserWidgetsPositionSchema
  ),
  async (c) => {
    try {
      const { widgets } = c.req.valid('json')
      const widgetsWithCorrectFormat = widgets.map(widget => ({
        usersHasWidgetsId: widget.usersHasWidgetsId,
        position: widget.position
      }))
      await updateUserWidgetsPosition(widgetsWithCorrectFormat)
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
