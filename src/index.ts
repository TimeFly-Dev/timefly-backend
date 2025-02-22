import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { openAPISpecs } from 'hono-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import { CONFIG } from '@/config'
import { auth } from '@/routes/auth'
import { sync } from '@/routes/sync'

const app = new Hono()

// Middlewares
app.use('*', prettyJSON())
app.use('*', logger())
app.use('*', cors())
app.use('*', secureHeaders())

app.get('/', (c) => c.text(`TimeFly API (${CONFIG.NODE_ENV})`))

// Include auth routes
app.route('/auth', auth)

// Include sync routes
app.route('/sync', sync)

// OpenAPI documentation
app.get(
	'/openapi',
	openAPISpecs(app, {
		documentation: {
			info: {
				title: 'TimeFly API',
				version: '1.0.0',
				description: 'API for TimeFly'
			},
			servers: [{ url: `http://localhost:${CONFIG.PORT}`, description: 'Local Server' }],
			components: {
				securitySchemes: {
					bearerAuth: {
						type: 'http',
						scheme: 'bearer',
						bearerFormat: 'JWT'
					}
				}
			},
			security: [{ bearerAuth: [] }]
		}
	})
)

// Scalar API Reference UI
app.get(
	'/docs',
	apiReference({
		spec: {
			url: '/openapi'
		},
		theme: 'default'
	})
)

const port = CONFIG.PORT
console.log(`API Documentation available at: http://localhost:${port}/docs`)

export default {
	port,
	fetch: app.fetch
}
