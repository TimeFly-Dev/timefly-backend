import { Hono } from 'hono'
import type { Context } from 'hono'
import { googleAuth } from '@hono/oauth-providers/google'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'
import { getCookie, setCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { CONFIG } from '@/config'
import { createUser, getUserById, getUserByGoogleId, updateUser } from '@/services/userService'
import { generateTokens, verifyRefreshToken } from '@/services/authService'
import { getApiKey } from '@/services/apiKeyService'
import type { GoogleUserResponse } from '@/types/auth'
import { errorResponseSchema } from '@/validations/authValidations'
import { authEventService } from '@/services/authEventService'
import { logger } from '@/utils/logger'

const auth = new Hono()

// Cookie configuration
const COOKIE_CONFIG = {
	// Expiration time for cookies
	accessTokenMaxAge: 60 * 60 * 24, // 1 day in seconds
	refreshTokenMaxAge: 60 * 60 * 24 * 30, // 30 days in seconds

	// Common options for cookies
	secure: process.env.NODE_ENV === 'production', // HTTPS only in production
	httpOnly: true, // Not accessible from JavaScript
	path: '/', // Available throughout the application
	sameSite: 'lax' as const // Protection against CSRF
}

// Google OAuth configuration
const googleAuthConfig = {
	client_id: CONFIG.GOOGLE_CLIENT_ID,
	client_secret: CONFIG.GOOGLE_CLIENT_SECRET,
	scope: ['openid', 'email', 'profile'],
	redirect_uri: `${CONFIG.BASE_URL}/auth/google/callback`
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
			302: {
				description: 'Redirect to frontend with authentication result'
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
			logger.info(`Google OAuth callback received for email: ${googleUser?.email || 'unknown'}`)

			if (!googleUser || !googleUser.id || !googleUser.email || !googleUser.name) {
				logger.error('Invalid Google user data:', googleUser)

				// Log failed authentication attempt
				authEventService.logEvent({
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

				// Redirect to frontend with error
				return c.redirect(`${CONFIG.FRONTEND_URL}/auth?error=invalid_user_data`)
			}

			let dbUser = await getUserByGoogleId(googleUser.id)
			let apiKey = null

			try {
				if (!dbUser) {
					logger.info(`Creating new user for Google ID: ${googleUser.id}, email: ${googleUser.email}`)
					dbUser = await createUser({
						googleId: googleUser.id,
						email: googleUser.email,
						fullName: googleUser.name,
						avatarUrl: googleUser.picture || ''
					})
				} else {
					logger.info(`Updating existing user: ${dbUser.id}, email: ${googleUser.email}`)
					await updateUser(dbUser.id, {
						email: googleUser.email,
						fullName: googleUser.name,
						avatarUrl: googleUser.picture || ''
					})
				}

				// Get the user's API key
				apiKey = await getApiKey(dbUser.id)

				// Log successful authentication
				authEventService.logEvent({
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
				logger.error('Database operation failed:', dbError)

				// Log failed authentication due to database error
				authEventService.logEvent({
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

				// Redirect to frontend with error
				return c.redirect(`${CONFIG.FRONTEND_URL}/auth?error=database_error`)
			}

			const clientInfo = {
				ipAddress: getClientIp(c),
				userAgent: c.req.header('user-agent') || ''
			}
			const { accessToken, refreshToken } = await generateTokens(dbUser, clientInfo)

			// Set secure cookies
			setCookie(c, 'access_token', accessToken, {
				maxAge: COOKIE_CONFIG.accessTokenMaxAge,
				httpOnly: COOKIE_CONFIG.httpOnly,
				secure: COOKIE_CONFIG.secure,
				path: COOKIE_CONFIG.path,
				sameSite: COOKIE_CONFIG.sameSite
			})

			setCookie(c, 'refresh_token', refreshToken, {
				maxAge: COOKIE_CONFIG.refreshTokenMaxAge,
				httpOnly: COOKIE_CONFIG.httpOnly,
				secure: COOKIE_CONFIG.secure,
				path: COOKIE_CONFIG.path,
				sameSite: COOKIE_CONFIG.sameSite
			})

			// Set cookie with basic user information (accessible from JavaScript)
			setCookie(
				c,
				'user_info',
				JSON.stringify({
					id: dbUser.id,
					email: dbUser.email,
					fullName: dbUser.fullName,
					avatarUrl: dbUser.avatarUrl,
					apiKey: apiKey // Include API key in user info
				}),
				{
					maxAge: COOKIE_CONFIG.accessTokenMaxAge,
					httpOnly: false, // This cookie is accessible from JavaScript
					secure: COOKIE_CONFIG.secure,
					path: COOKIE_CONFIG.path,
					sameSite: COOKIE_CONFIG.sameSite
				}
			)

			logger.info(`Authentication successful for user: ${dbUser.id}, redirecting to frontend`)
			// Redirect to frontend after successful authentication
			return c.redirect(`${CONFIG.FRONTEND_URL}/auth/callback?success=true`)
		} catch (error) {
			logger.error('Authentication error:', error)

			// Log failed authentication due to unexpected error
			authEventService.logEvent({
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

			// Redirect to frontend with error
			return c.redirect(`${CONFIG.FRONTEND_URL}/auth?error=authentication_failed`)
		}
	}
)

// Refresh token route
auth.post(
	'/refresh-token',
	describeRoute({
		description: 'Refresh access token using the refresh token cookie',
		tags: ['Authentication'],
		responses: {
			200: {
				description: 'Access token refreshed successfully'
			},
			401: {
				description: 'Invalid or expired refresh token'
			}
		}
	}),
	async (c: Context) => {
		try {
			// Get refresh token from cookie
			const refreshToken = getCookie(c, 'refresh_token')

			if (!refreshToken) {
				logger.warn('Token refresh failed: No refresh token provided')
				return c.json(
					{
						success: false,
						error: 'Refresh token not found'
					},
					401
				)
			}

			const userId = await verifyRefreshToken(refreshToken)
			logger.info(`Token refresh requested for user: ${userId}`)

			const userData = await getUserById(userId)
			const clientInfo = {
				ipAddress: getClientIp(c),
				userAgent: c.req.header('user-agent') || ''
			}
			const tokens = await generateTokens(userData, clientInfo)

			// Get the user's API key
			const apiKey = await getApiKey(userId)

			// Update cookies
			setCookie(c, 'access_token', tokens.accessToken, {
				maxAge: COOKIE_CONFIG.accessTokenMaxAge,
				httpOnly: COOKIE_CONFIG.httpOnly,
				secure: COOKIE_CONFIG.secure,
				path: COOKIE_CONFIG.path,
				sameSite: COOKIE_CONFIG.sameSite
			})

			setCookie(c, 'refresh_token', tokens.refreshToken, {
				maxAge: COOKIE_CONFIG.refreshTokenMaxAge,
				httpOnly: COOKIE_CONFIG.httpOnly,
				secure: COOKIE_CONFIG.secure,
				path: COOKIE_CONFIG.path,
				sameSite: COOKIE_CONFIG.sameSite
			})

			// Update user info cookie
			setCookie(
				c,
				'user_info',
				JSON.stringify({
					id: userData.id,
					email: userData.email,
					fullName: userData.fullName,
					avatarUrl: userData.avatarUrl,
					apiKey: apiKey // Include API key in user info
				}),
				{
					maxAge: COOKIE_CONFIG.accessTokenMaxAge,
					httpOnly: false,
					secure: COOKIE_CONFIG.secure,
					path: COOKIE_CONFIG.path,
					sameSite: COOKIE_CONFIG.sameSite
				}
			)

			// Log successful token refresh
			authEventService.logEvent({
				timestamp: new Date(),
				user_id: userId,
				email: userData.email,
				success: true,
				ip_address: getClientIp(c),
				user_agent: c.req.header('user-agent') || '',
				country_code: 'UN',
				city: 'Unknown',
				provider: 'local'
			})

			logger.info(`Token refresh successful for user: ${userId}`)
			return c.json({
				success: true,
				data: {
					apiKey: apiKey // Include API key in response
				}
			})
		} catch (error) {
			logger.error('Token refresh error:', error)

			// Log failed token refresh
			authEventService.logEvent({
				timestamp: new Date(),
				user_id: 0,
				email: 'unknown',
				success: false,
				ip_address: getClientIp(c),
				user_agent: c.req.header('user-agent') || '',
				country_code: 'UN',
				city: 'Unknown',
				provider: 'local',
				error_message: 'Invalid refresh token'
			})

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

// Logout route
auth.post(
	'/logout',
	describeRoute({
		description: 'Logout user by clearing auth cookies',
		tags: ['Authentication'],
		responses: {
			200: {
				description: 'Logout successful'
			}
		}
	}),
	async (c: Context) => {
		// Try to get user ID for logging
		const accessToken = getCookie(c, 'access_token')
		let userId = 0
		let email = 'unknown'

		try {
			if (accessToken) {
				const userInfo = getCookie(c, 'user_info')
				if (userInfo) {
					const parsedInfo = JSON.parse(userInfo)
					userId = parsedInfo.id
					email = parsedInfo.email
				}
			}
		} catch (_error) {
			// Ignore errors in getting user ID
		}

		logger.info(`Logout requested for user: ${userId}`)

		// Log logout event if we have a user ID
		if (userId > 0) {
			authEventService.logEvent({
				timestamp: new Date(),
				user_id: userId,
				email,
				success: true,
				ip_address: getClientIp(c),
				user_agent: c.req.header('user-agent') || '',
				country_code: 'UN',
				city: 'Unknown',
				provider: 'local'
			})
		}

		// Remove cookies by setting maxAge to 0
		setCookie(c, 'access_token', '', {
			maxAge: 0,
			httpOnly: COOKIE_CONFIG.httpOnly,
			secure: COOKIE_CONFIG.secure,
			path: COOKIE_CONFIG.path,
			sameSite: COOKIE_CONFIG.sameSite
		})

		setCookie(c, 'refresh_token', '', {
			maxAge: 0,
			httpOnly: COOKIE_CONFIG.httpOnly,
			secure: COOKIE_CONFIG.secure,
			path: COOKIE_CONFIG.path,
			sameSite: COOKIE_CONFIG.sameSite
		})

		setCookie(c, 'user_info', '', {
			maxAge: 0,
			httpOnly: false,
			secure: COOKIE_CONFIG.secure,
			path: COOKIE_CONFIG.path,
			sameSite: COOKIE_CONFIG.sameSite
		})

		logger.info(`Logout successful for user: ${userId}`)
		return c.json({
			success: true,
			message: 'Logged out successfully'
		})
	}
)

// User info route
auth.get(
	'/me',
	describeRoute({
		description: 'Get current user information',
		tags: ['Authentication'],
		responses: {
			200: {
				description: 'User information retrieved successfully'
			},
			401: {
				description: 'Not authenticated'
			}
		}
	}),
	async (c: Context) => {
		// Check if user is authenticated by verifying access_token cookie
		const accessToken = getCookie(c, 'access_token')

		if (!accessToken) {
			logger.warn('User info request failed: No access token provided')
			return c.json(
				{
					success: false,
					error: 'Not authenticated'
				},
				401
			)
		}

		try {
			// Get user info from user_info cookie
			const userInfoCookie = getCookie(c, 'user_info')

			if (userInfoCookie) {
				const userInfo = JSON.parse(userInfoCookie)
				logger.info(`User info requested for user: ${userInfo.id}`)

				// If API key is not in the cookie, fetch it
				if (!userInfo.apiKey) {
					try {
						const userId = userInfo.id
						logger.debug(`Fetching API key for user: ${userId} (not found in cookie)`)
						const apiKey = await getApiKey(userId)

						// Create updated user info without mutating original
						const updatedUserInfo = {
							...userInfo,
							apiKey
						}

						// Update the cookie with the API key
						setCookie(c, 'user_info', JSON.stringify(updatedUserInfo), {
							maxAge: COOKIE_CONFIG.accessTokenMaxAge,
							httpOnly: false,
							secure: COOKIE_CONFIG.secure,
							path: COOKIE_CONFIG.path,
							sameSite: COOKIE_CONFIG.sameSite
						})

						// Return the updated user info
						return c.json({
							success: true,
							data: {
								user: updatedUserInfo
							}
						})
					} catch (apiKeyError) {
						logger.error('Error fetching API key:', apiKeyError)
					}
				}

				return c.json({
					success: true,
					data: {
						user: userInfo
					}
				})
			}

			// If no user_info cookie but access_token is valid, recover user info from database
			logger.info('User info cookie not found, recovering from token')

			try {
				// Extract userId from access_token
				const payload = await verify(accessToken, CONFIG.JWT_ACCESS_SECRET, 'HS256')
				const userId = payload.userId as number

				logger.debug(`Recovering user info for userId: ${userId} from database`)

				// Get user data from database
				const userData = await getUserById(userId)

				if (!userData) {
					logger.warn(`User with ID ${userId} not found in database`)
					return c.json(
						{
							success: false,
							error: 'User not found'
						},
						404
					)
				}

				// Get API key
				const apiKey = await getApiKey(userId)

				// Create user info object
				const userInfo = {
					id: userData.id,
					email: userData.email,
					fullName: userData.fullName,
					avatarUrl: userData.avatarUrl,
					apiKey
				}

				// Set user_info cookie
				setCookie(c, 'user_info', JSON.stringify(userInfo), {
					maxAge: COOKIE_CONFIG.accessTokenMaxAge,
					httpOnly: false,
					secure: COOKIE_CONFIG.secure,
					path: COOKIE_CONFIG.path,
					sameSite: COOKIE_CONFIG.sameSite
				})

				logger.info(`User info successfully recovered for user: ${userId}`)

				// Return the recovered user info
				return c.json({
					success: true,
					data: {
						user: userInfo
					}
				})
			} catch (tokenError) {
				logger.error('Error recovering user info from token:', tokenError)
				return c.json(
					{
						success: false,
						error: 'Invalid access token'
					},
					401
				)
			}
		} catch (error) {
			logger.error('Error getting user info:', error)
			return c.json(
				{
					success: false,
					error: 'Failed to get user information'
				},
				500
			)
		}
	}
)

export { auth }
