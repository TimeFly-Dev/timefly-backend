import { Hono } from 'hono'
import type { Context } from 'hono'
import { googleAuth } from '@hono/oauth-providers/google'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi/zod'
import { CONFIG } from '@/config'
import { createUser, getUserByGoogleId, updateUser } from '@/services/userService'
import { generateTokens, verifyRefreshToken } from '@/services/authService'
import type { GoogleUserResponse } from '@/types/auth'
import { googleCallbackSchema, refreshTokenSchema, tokenResponseSchema, errorResponseSchema } from '@/validations/authValidations'
import { authLoggingService } from '@/services/authLoggingService'

const auth = new Hono()

const googleAuthConfig = {
	client_id: CONFIG.GOOGLE_CLIENT_ID,
	client_secret: CONFIG.GOOGLE_CLIENT_SECRET,
	scope: ['openid', 'email', 'profile'],
	redirect_uri: 'http://localhost:3000/auth/google/callback'
}

// Helper function to get client IP
const getClientIp = (c: Context): string => {
	return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || 'unknown'
}

// Google OAuth initiation route
auth.get(
	'/google',
	describeRoute({
		description: 'Initiate Google OAuth flow',
		tags: ['Authentication'],
		responses: {
			302: {
				description: 'Redirect to Google OAuth consent screen'
			}
		}
	}),
	googleAuth(googleAuthConfig)
)

// Google OAuth callback route
auth.get(
	'/google/callback',
	describeRoute({
		description: 'Handle Google OAuth callback',
		tags: ['Authentication'],
		responses: {
			200: {
				description: 'Authentication successful',
				content: {
					'application/json': {
						schema: resolver(googleCallbackSchema)
					}
				}
			},
			401: {
				description: 'Authentication failed',
				content: {
					'application/json': {
						schema: resolver(errorResponseSchema)
					}
				}
			},
			500: {
				description: 'Server error',
				content: {
					'application/json': {
						schema: resolver(errorResponseSchema)
					}
				}
			}
		}
	}),
	googleAuth(googleAuthConfig),
	async (c: Context) => {
		try {
			const googleUser = c.get('user-google') as GoogleUserResponse

			if (!googleUser || !googleUser.id || !googleUser.email || !googleUser.name) {
				console.error('Invalid Google user data:', googleUser)

				// Log failed authentication attempt
				authLoggingService.logAuth({
					timestamp: new Date(),
					user_id: 0, // 0 for unknown user
					email: googleUser?.email || 'unknown',
					success: false,
					ip_address: getClientIp(c),
					user_agent: c.req.header('user-agent') || '',
					country_code: 'UN', // You might want to use a geo-ip service to get this
					city: 'Unknown',
					provider: 'google',
					error_message: 'Invalid authentication data'
				})

				return c.json(
					{
						success: false,
						error: 'Invalid authentication data'
					},
					401
				)
			}

			let dbUser = await getUserByGoogleId(googleUser.id)

			try {
				if (!dbUser) {
					dbUser = await createUser({
						googleId: googleUser.id,
						email: googleUser.email,
						fullName: googleUser.name,
						avatarUrl: googleUser.picture || ''
					})
				} else {
					await updateUser(dbUser.id, {
						email: googleUser.email,
						fullName: googleUser.name,
						avatarUrl: googleUser.picture || ''
					})
				}

				// Log successful authentication
				authLoggingService.logAuth({
					timestamp: new Date(),
					user_id: dbUser.id,
					email: dbUser.email,
					success: true,
					ip_address: getClientIp(c),
					user_agent: c.req.header('user-agent') || '',
					country_code: 'UN',
					city: 'Unknown',
					provider: 'google'
				})
			} catch (dbError) {
				console.error('Database operation failed:', dbError)

				// Log failed authentication due to database error
				authLoggingService.logAuth({
					timestamp: new Date(),
					user_id: 0,
					email: googleUser.email,
					success: false,
					ip_address: getClientIp(c),
					user_agent: c.req.header('user-agent') || '',
					country_code: 'UN',
					city: 'Unknown',
					provider: 'google',
					error_message: 'Database operation failed'
				})

				return c.json(
					{
						success: false,
						error: 'Database operation failed'
					},
					500
				)
			}

			const { accessToken, refreshToken } = await generateTokens(dbUser.id)

			return c.json({
				success: true,
				data: {
					accessToken,
					refreshToken,
					user: {
						id: dbUser.id,
						email: dbUser.email,
						fullName: dbUser.fullName,
						avatarUrl: dbUser.avatarUrl
					}
				}
			})
		} catch (error) {
			console.error('Authentication error:', error)

			// Log failed authentication due to unexpected error
			authLoggingService.logAuth({
				timestamp: new Date(),
				user_id: 0,
				email: 'unknown',
				success: false,
				ip_address: getClientIp(c),
				user_agent: c.req.header('user-agent') || '',
				country_code: 'UN',
				city: 'Unknown',
				provider: 'google',
				error_message: 'Authentication failed'
			})

			return c.json(
				{
					success: false,
					error: 'Authentication failed'
				},
				500
			)
		}
	}
)

// Refresh token route
auth.post(
	'/refresh-token',
	describeRoute({
		description: 'Refresh access token using a valid refresh token',
		tags: ['Authentication'],
		responses: {
			200: {
				description: 'New tokens generated successfully',
				content: {
					'application/json': {
						schema: resolver(tokenResponseSchema)
					}
				}
			},
			400: {
				description: 'Invalid request',
				content: {
					'application/json': {
						schema: resolver(errorResponseSchema)
					}
				}
			},
			401: {
				description: 'Invalid or expired refresh token',
				content: {
					'application/json': {
						schema: resolver(errorResponseSchema)
					}
				}
			}
		}
	}),
	zValidator('json', refreshTokenSchema),
	async (c: Context) => {
		try {
			const { refreshToken } = refreshTokenSchema.parse(await c.req.json())
			const userId = await verifyRefreshToken(refreshToken)
			const tokens = await generateTokens(userId)

			return c.json({
				success: true,
				data: tokens
			})
		} catch (error) {
			console.error('Token refresh error:', error)
			return c.json(
				{
					success: false,
					error: 'Invalid refresh token'
				},
				401
			)
		}
	}
)

export { auth }
