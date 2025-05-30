import { Hono } from 'hono'
import { generateTokens } from '../../services/authService'
import { createUser, getUserByGoogleId } from '../../services/userService'
import type { DbUser } from '../../types/auth'
import { cookieAuthMiddleware } from '../../middleware/cookieAuthMiddleware'
import { apiKeyAuthMiddleware } from '../../middleware/apiKeyAuthMiddleware.ts'
import { CONFIG } from '../../config'
import { verify } from 'hono/jwt'

export interface TestUser {
  user: DbUser
  tokens: {
    accessToken: string
    refreshToken: string
    tokenId: string
  }
}

export const mockClientInfo = {
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0 (Test Browser)'
}

export const mockGoogleUser = {
  id: '123456789',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/avatar.jpg'
}

/**
 * Creates a test user with authentication tokens
 */
export async function createTestUser(): Promise<TestUser> {
  // Check if user already exists
  let user = await getUserByGoogleId(mockGoogleUser.id)
  
  if (!user) {
    user = await createUser({
      googleId: mockGoogleUser.id,
      email: mockGoogleUser.email,
      fullName: mockGoogleUser.name,
      avatarUrl: mockGoogleUser.picture
    })
  }

  const tokens = await generateTokens(user, mockClientInfo)

  return {
    user,
    tokens
  }
}

/**
 * Creates a test app instance with authentication middleware
 */
export function createTestApp(): Hono {
  const app = new Hono()

  // Mock Google OAuth middleware
  app.use('/auth/google/callback', async (c, next) => {
    // Set mock Google user data
    c.set('user-google', mockGoogleUser)
    
    // Get or create user
    let user = await getUserByGoogleId(mockGoogleUser.id)
    if (!user) {
      user = await createUser({
        googleId: mockGoogleUser.id,
        email: mockGoogleUser.email,
        fullName: mockGoogleUser.name,
        avatarUrl: mockGoogleUser.picture
      })
    }

    // Generate tokens
    const tokens = await generateTokens(user, mockClientInfo)

    // Set cookies
    c.header('Set-Cookie', `access_token=${tokens.accessToken}; Path=/; HttpOnly`)
    c.header('Set-Cookie', `refresh_token=${tokens.refreshToken}; Path=/; HttpOnly`)

    // Redirect to frontend
    return c.redirect(`${CONFIG.FRONTEND_URL}/auth/callback?success=true`)
  })

  // Add auth routes
  app.get('/auth/me', cookieAuthMiddleware, async (c) => {
    const user = c.get('user')
    return c.json({
      success: true,
      data: { user }
    })
  })

  app.post('/auth/refresh-token', async (c) => {
    const refreshToken = c.req.header('Cookie')?.match(/refresh_token=([^;]+)/)?.[1]
    
    if (!refreshToken) {
      return c.json({
        success: false,
        error: 'Refresh token not found'
      }, 401)
    }

    try {
      await verify(refreshToken, CONFIG.JWT_REFRESH_SECRET)
      return c.json({ success: true })
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid refresh token'
      }, 401)
    }
  })

  app.post('/auth/logout', async (c) => {
    return c.json({ success: true })
  })

  // Add protected route for API key testing
  app.get('/api/protected-route', apiKeyAuthMiddleware, async (c) => {
    return c.json({ success: true })
  })

  return app
}

/**
 * Creates authentication headers for testing authenticated routes
 */
export function createAuthHeaders(tokens: { accessToken: string; refreshToken: string }) {
  return {
    'Cookie': `access_token=${tokens.accessToken}; refresh_token=${tokens.refreshToken}`
  }
} 