import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import { logger as honoLogger } from 'hono/logger'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { openAPISpecs } from 'hono-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { CONFIG } from './config'
import { auth } from './routes/auth'
import { sync } from './routes/sync'
import { stats } from './routes/stats'
import { exports } from './routes/exports'
import { dashboard } from './routes/dashboard'
import { apiKeys } from './routes/apiKeys'
import { apiKeyStats } from './routes/apiKeyStats'
import { authStats } from './routes/authStats'
import { sessions } from './routes/sessions'
import { logger } from './utils/logger'

const app = new Hono()

// Middlewares
app.use('*', prettyJSON())
app.use('*', honoLogger())
app.use(
	'*',
	cors({
		origin: CONFIG.FRONTEND_URL || '*',
		credentials: true,
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
		exposeHeaders: ['Content-Length', 'X-Powered-By']
	})
)
app.use('*', secureHeaders())

app.get('/', (c) => {
	logger.info(`API request to root endpoint (${CONFIG.NODE_ENV})`)
	return c.text(`TimeFly API (${CONFIG.NODE_ENV})`)
})

app.route('/auth', auth)
app.route('/sync', sync)
app.route('/stats', stats)
app.route('/exports', exports)
app.route('/api-keys', apiKeys)
app.route('/api-key-stats', apiKeyStats)
app.route('/auth-stats', authStats)
app.route('/sessions', sessions)
app.route('/dashboard', dashboard)


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
			servers: [{ url: CONFIG.BASE_URL, description: `${CONFIG.NODE_ENV} Server` }],
			components: {
				securitySchemes: {
					bearerAuth: {
						type: 'http',
						scheme: 'bearer',
						bearerFormat: 'JWT'
					},
					apiKeyAuth: {
						type: 'apiKey',
						in: 'header',
						name: 'X-API-Key'
					}
				}
			}
		}
	})
)

// Scalar API Reference UI
app.get(
	'/docs',
	Scalar({
		url: '/openapi',
		theme: 'default'
	})
)

const port = CONFIG.PORT
console.log(`API Documentation available at: http://localhost:${port}/docs`)

export default {
	port,
	fetch: app.fetch
}
