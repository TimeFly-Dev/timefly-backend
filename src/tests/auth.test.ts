import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createTestApp, createTestUser, createAuthHeaders, mockGoogleUser } from './helpers/authTestHelper'
import type { TestUser } from './helpers/authTestHelper'
import { getUserByGoogleId } from '../services/userService'
import { verifyAccessToken } from '../services/authService'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

interface UserInfo {
  user: {
    id: number
    email: string
    fullName: string
    avatarUrl: string
  }
}

describe('Authentication Tests', () => {
  let app: ReturnType<typeof createTestApp>
  let testUser: TestUser

  beforeAll(async () => {
    app = createTestApp()
    testUser = await createTestUser()
  })

  test('should create a new user with Google OAuth data', async () => {
    const user = await getUserByGoogleId(mockGoogleUser.id)
    expect(user).toBeDefined()
    expect(user?.email).toBe(mockGoogleUser.email)
    expect(user?.fullName).toBe(mockGoogleUser.name)
  })

  test('should generate valid tokens for authentication', async () => {
    expect(testUser.tokens).toBeDefined()
    expect(testUser.tokens.accessToken).toBeDefined()
    expect(testUser.tokens.refreshToken).toBeDefined()
    expect(testUser.tokens.tokenId).toBeDefined()
  })

  test('should handle Google OAuth callback successfully', async () => {
    const response = await app.request('/auth/google/callback', {
      headers: {
        'User-Agent': 'Test Browser'
      }
    })
    expect(response.status).toBe(302) // Should redirect after successful auth
  })

  test('should handle token refresh', async () => {
    const response = await app.request('/auth/refresh-token', {
      method: 'POST',
      headers: {
        ...createAuthHeaders(testUser.tokens),
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(200)
    const data = await response.json() as ApiResponse<null>
    expect(data.success).toBe(true)
  })

  test('should handle logout', async () => {
    const response = await app.request('/auth/logout', {
      method: 'POST',
      headers: {
        ...createAuthHeaders(testUser.tokens),
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(200)
    const data = await response.json() as ApiResponse<null>
    expect(data.success).toBe(true)
  })

  test('should get user info when authenticated', async () => {
    const response = await app.request('/auth/me', {
      headers: {
        ...createAuthHeaders(testUser.tokens),
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(200)
    const data = await response.json() as ApiResponse<UserInfo>
    expect(data.success).toBe(true)
    expect(data.data?.user.email).toBe(testUser.user.email)
  })

  test('should reject unauthenticated requests', async () => {
    const response = await app.request('/auth/me', {
      headers: {
        'User-Agent': 'Test Browser'
      }
    })
    expect(response.status).toBe(401)
    const data = await response.json() as ApiResponse<null>
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  test('should verify access token', async () => {
    const userId = await verifyAccessToken(testUser.tokens.accessToken)
    expect(userId).toBe(testUser.user.id)
  })

  test('should reject expired access token', async () => {
    // Create a token that expired 1 hour ago
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    
    const response = await app.request('/auth/me', {
      headers: {
        'Cookie': `access_token=${expiredToken}`,
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(401)
    const data = await response.json() as ApiResponse<null>
    expect(data.success).toBe(false)
    expect(data.error).toContain('Authentication required')
  })

  test('should reject invalid access token', async () => {
    const response = await app.request('/auth/me', {
      headers: {
        'Cookie': 'access_token=invalid-token',
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(401)
    const data = await response.json() as ApiResponse<null>
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  test('should reject missing refresh token', async () => {
    const response = await app.request('/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Cookie': 'access_token=expired-token',
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(401)
    const data = await response.json() as ApiResponse<null>
    expect(data.success).toBe(false)
    expect(data.error).toContain('Refresh token not found')
  })

  test('should reject invalid refresh token', async () => {
    const response = await app.request('/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Cookie': 'refresh_token=invalid-refresh-token',
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(401)
    const data = await response.json() as ApiResponse<null>
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  test('should reject missing access token', async () => {
    const response = await app.request('/auth/me', {
      headers: {
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(401)
    const data = await response.json() as ApiResponse<null>
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })
})