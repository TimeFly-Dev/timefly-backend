import { describe, test, expect, beforeAll, afterEach, mock } from 'bun:test'
import { Hono } from 'hono'
import { createTestUser } from './helpers/authTestHelper'
import type { TestUser } from './helpers/authTestHelper'
import type { ApiKeyDailyStat, ApiKeyStatsResponse } from '../types/apiKeyEvents'
import { apiKeyStats } from '../routes/apiKeyStats'
import { cookieAuthMiddleware } from '../middleware/cookieAuthMiddleware'

// Mock stats data
const mockStats: ApiKeyDailyStat[] = [
  {
    user_id: 1,
    date: '2024-03-20',
    event_type: 1,
    event_count: 2
  },
  {
    user_id: 1,
    date: '2024-03-20',
    event_type: 2,
    event_count: 1
  }
]

// Create mock implementations
const mockGetStats = mock(async (): Promise<ApiKeyStatsResponse> => ({
  success: true,
  data: {
    stats: mockStats,
    totalCreated: 2,
    totalRegenerated: 1
  }
}))

const mockGetRecentEvents = mock(async (): Promise<ApiKeyStatsResponse> => ({
  success: true,
  data: {
    stats: mockStats,
    totalCreated: 2,
    totalRegenerated: 1
  }
}))

const mockLogEvent = mock(async () => {})

// Mock the module
mock.module('../services/apiKeyLoggingService', () => ({
  apiKeyLoggingService: {
    getStats: mockGetStats,
    getRecentEvents: mockGetRecentEvents,
    logEvent: mockLogEvent
  }
}))

function createTestApp() {
  const app = new Hono()
  
  // Add cookie auth middleware
  app.use('*', cookieAuthMiddleware)
  
  // Add API key stats routes
  app.route('', apiKeyStats)
  
  return app
}

describe('API Key Stats Routes', () => {
  let app: Hono
  let testUser: TestUser

  beforeAll(async () => {
    app = createTestApp()
    testUser = await createTestUser()
  })

  afterEach(() => {
    mockGetStats.mockClear()
    mockGetRecentEvents.mockClear()
  })

  describe('GET /api-key-stats', () => {
    test('should return API key statistics for authenticated user', async () => {
      // Create a new request with proper cookies
      const request = new Request('http://localhost/', {
        method: 'GET',
        headers: {
          'User-Agent': 'Test Browser',
          'Cookie': `access_token=${testUser.tokens.accessToken}; refresh_token=${testUser.tokens.refreshToken}`
        },
        credentials: 'include'
      })
      
      const response = await app.fetch(request)

      // Clone the response to read it multiple times
      const response1 = response.clone()
      const response2 = response.clone()
      
      // Log response status and body
      const responseBody = await response1.text()
      console.log('Response status:', response.status)
      console.log('Response body:', responseBody)
      
      // Parse the response as JSON for assertions
      const data = (await response2.json()) as ApiKeyStatsResponse
      
      // Assert the response status
      expect(response.status).toBe(200)
      
      expect(data).toMatchObject({
        success: true,
        data: {
          totalCreated: 2,
          totalRegenerated: 1
        }
      })
      
      expect(mockGetStats).toHaveBeenCalledTimes(1)
    })

    test('should accept custom date range', async () => {
      // Setup mock with specific response
      mockGetStats.mockImplementationOnce(async () => ({
        success: true,
        data: {
          stats: [],
          totalCreated: 0,
          totalRegenerated: 0
        }
      }))

      const request = new Request(
        'http://localhost/?startDate=2024-01-01&endDate=2024-12-31',
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Test Browser',
            'Cookie': `access_token=${testUser.tokens.accessToken}; refresh_token=${testUser.tokens.refreshToken}`
          },
          credentials: 'include'
        }
      )
      const response = await app.fetch(request)
      
      // Clone the response to read it multiple times
      const response1 = response.clone()
      
      // Parse the response as JSON for assertions
      const data = (await response1.json()) as { success: boolean }
      
      // Assert the response status and data
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      expect(mockGetStats).toHaveBeenCalledTimes(1)
    })

    test('should return 401 for unauthenticated requests', async () => {
      // Create a request without any authentication cookies
      const request = new Request('http://localhost/')
      
      // Remove any default headers that might be set
      const headers = new Headers()
      headers.set('User-Agent', 'Test Browser')
      
      // Ensure no cookies are set
      Object.defineProperty(request, 'headers', { value: headers })
      
      const response = await app.fetch(request)
      
      // Clone the response to read it multiple times
      const response1 = response.clone()
      
      // Parse the response as JSON for assertions
      const data = (await response1.json()) as { success: boolean; error: string }
      
      // Assert the response status and data
      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Authentication required')
    })

    test('should validate date format', async () => {
      const request = new Request(
        'http://localhost/?startDate=invalid-date',
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Test Browser',
            'Cookie': `access_token=${testUser.tokens.accessToken}; refresh_token=${testUser.tokens.refreshToken}`
          },
          credentials: 'include'
        }
      )
      const response = await app.fetch(request)
      
      // Clone the response to read it multiple times
      const response1 = response.clone()
      
      // Parse the response as JSON for assertions
      const data = (await response1.json()) as { success: boolean; error: string }
      
      // Assert the response status and data
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid date format')
    })

    test('should handle service errors', async () => {
      // Setup mock to throw an error
      mockGetStats.mockImplementationOnce(async () => {
        throw new Error('Database connection failed')
      })

      const request = new Request('http://localhost/', {
        method: 'GET',
        headers: {
          'User-Agent': 'Test Browser',
          'Cookie': `access_token=${testUser.tokens.accessToken}; refresh_token=${testUser.tokens.refreshToken}`
        },
        credentials: 'include'
      })
      const response = await app.fetch(request)
      
      // Clone the response to read it multiple times
      const response1 = response.clone()
      
      // Parse the response as JSON for assertions
      const data = (await response1.json()) as { success: boolean; error: string }
      
      // Assert the response status and data
      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Failed to retrieve API key statistics')
    })
  })

  describe('GET /api-key-stats/recent', () => {
    test('should return recent API key events', async () => {
      const request = new Request('http://localhost/recent?limit=5', {
        method: 'GET',
        headers: {
          'User-Agent': 'Test Browser',
          'Cookie': `access_token=${testUser.tokens.accessToken}; refresh_token=${testUser.tokens.refreshToken}`
        },
        credentials: 'include'
      })
      const response = await app.fetch(request)
      
      // Clone the response to read it multiple times
      const response1 = response.clone()
      
      // Parse the response as JSON for assertions
      const data = (await response1.json()) as ApiKeyStatsResponse
      
      // Assert the response status and data
      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        data: {
          totalCreated: 2,
          totalRegenerated: 1
        }
      })
      
      expect(mockGetRecentEvents).toHaveBeenCalledTimes(1)
    })

    test('should use default limit if not specified', async () => {
      // Setup mock with default limit response
      mockGetRecentEvents.mockImplementationOnce(async () => ({
        success: true,
        data: {
          stats: [],
          totalCreated: 0,
          totalRegenerated: 0
        }
      }))

      const request = new Request('http://localhost/recent', {
        method: 'GET',
        headers: {
          'User-Agent': 'Test Browser',
          'Cookie': `access_token=${testUser.tokens.accessToken}; refresh_token=${testUser.tokens.refreshToken}`
        },
        credentials: 'include'
      })
      const response = await app.fetch(request)
      
      // Clone the response to read it
      const response1 = response.clone()
      
      // Parse the response as JSON
      const data = (await response1.json()) as { success: boolean; data: { events: unknown[] } }
      
      // Assert the response status and data
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      expect(mockGetRecentEvents).toHaveBeenCalledTimes(1)
    })

    test('should validate limit parameter', async () => {
      // Create a request with an invalid limit parameter (non-numeric)
      const request = new Request('http://localhost/recent?limit=invalid', {
        method: 'GET',
        headers: {
          'User-Agent': 'Test Browser',
          'Cookie': `access_token=${testUser.tokens.accessToken}; refresh_token=${testUser.tokens.refreshToken}`
        },
        credentials: 'include'
      })
      
      const response = await app.fetch(request)
      
      // Clone the response to read it multiple times
      const response1 = response.clone()
      
      // Parse the response as JSON for assertions
      const data = (await response1.json()) as { success: boolean; error: string }
      
      // Assert the response status and data
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      // Check for specific validation error message
      expect(data.error).toContain('Invalid limit parameter')
      
      // Test with a limit that's out of range
      const request2 = new Request('http://localhost/recent?limit=101', {
        method: 'GET',
        headers: {
          'User-Agent': 'Test Browser',
          'Cookie': `access_token=${testUser.tokens.accessToken}; refresh_token=${testUser.tokens.refreshToken}`
        },
        credentials: 'include'
      })
      
      const response2 = await app.fetch(request2)
      const response2Clone = response2.clone()
      const data2 = (await response2Clone.json()) as { success: boolean; error: string }
      
      expect(response2.status).toBe(400)
      expect(data2.success).toBe(false)
      expect(data2.error).toContain('Invalid limit parameter')
    })
  })
})
