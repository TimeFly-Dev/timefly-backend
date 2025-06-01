import { describe, test, expect, beforeAll } from 'bun:test'
import { createTestApp, createTestUser } from './helpers/authTestHelper'
import { getApiKey, validateApiKey } from '../services/apiKeyService'
import { CONFIG } from '../config'

interface ApiResponse<T = null> {
  success: boolean
  data?: T
  error?: string
}

describe('API Key Authentication Tests', () => {
  let app: ReturnType<typeof createTestApp>
  let testUser: Awaited<ReturnType<typeof createTestUser>>
  let apiKey: string

  beforeAll(async () => {
    app = createTestApp()
    testUser = await createTestUser()
    const key = await getApiKey(testUser.user.id)
    if (!key) {
      throw new Error('Failed to get API key for test user')
    }
    apiKey = key
  })

  test('should get API key for user', async () => {
    expect(apiKey).toBeDefined()
    expect(typeof apiKey).toBe('string')
  })

  test('should validate API key', async () => {
    const userId = await validateApiKey(apiKey)
    expect(userId).toBe(testUser.user.id)
  })

  test('should authenticate with valid API key', async () => {
    const response = await app.request('/api/protected-route', {
      headers: {
        'X-API-Key': apiKey,
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(200)
    const data = await response.json() as ApiResponse
    expect(data.success).toBe(true)
  })

  test('should reject invalid API key', async () => {
    const response = await app.request('/api/protected-route', {
      headers: {
        'X-API-Key': 'invalid-api-key',
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(401)
    const data = await response.json() as ApiResponse
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  test('should reject request without API key', async () => {
    const response = await app.request('/api/protected-route', {
      headers: {
        'User-Agent': 'Test Browser'
      }
    })
    expect(response.status).toBe(401)
    const data = await response.json() as ApiResponse
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  test('should reject malformed API key', async () => {
    const response = await app.request('/api/protected-route', {
      headers: {
        'X-API-Key': 'not-a-valid-hex-string',
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(401)
    const data = await response.json() as ApiResponse
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  test('should reject API key with wrong length', async () => {
    const response = await app.request('/api/protected-route', {
      headers: {
        'X-API-Key': 'short',
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(401)
    const data = await response.json() as ApiResponse
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  test('should handle API key validation error', async () => {
    const response = await app.request('/api/protected-route', {
      headers: {
        'X-API-Key': 'a'.repeat(64), // Valid length but invalid format
        'User-Agent': 'Test Browser'
      }
    })
    
    expect(response.status).toBe(401)
    const data = await response.json() as ApiResponse
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })
}) 