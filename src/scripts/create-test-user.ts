import { mysqlPool } from '../db/mysql'
import { generateTokens } from '../services/authService'
import { createUser } from '../services/userService'
import { getApiKey, regenerateApiKey } from '../services/apiKeyService'
import { CONFIG } from '../config'
import type { DbUser } from '../types/auth'

interface TestUser {
  id: number
  email: string
  fullName: string
  apiKey: string
  tokens: {
    accessToken: string
    refreshToken: string
    tokenId: string
  }
}

async function createTestUser(email: string = 'test@example.com'): Promise<TestUser> {
  const connection = await mysqlPool.getConnection()
  
  try {
    // Check if user already exists
    const [existingUsers] = await connection.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    ) as any[]

    let userId: number
    let apiKey: string

    if (existingUsers.length > 0) {
      // Use existing user
      userId = existingUsers[0].id
      apiKey = existingUsers[0].api_key || await regenerateApiKey(userId)
    } else {
      // Create new user
      const [result] = await connection.query(
        `INSERT INTO users (
          email,
          full_name,
          google_id,
          avatar_url,
          subscription_status,
          plan_name,
          billing_cycle,
          mrr
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          email,
          'Test User',
          `test-${Date.now()}`, // Unique test Google ID
          'https://example.com/avatar.jpg',
          'active',
          'Pro',
          'monthly',
          29.99
        ]
      ) as any[]

      userId = result.insertId
      apiKey = await regenerateApiKey(userId)
    }

    // Generate tokens
    const user: DbUser = {
      id: userId,
      email,
      fullName: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      googleId: `test-${Date.now()}`
    }

    const tokens = await generateTokens(user, {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Script'
    })

    return {
      id: userId,
      email,
      fullName: 'Test User',
      apiKey,
      tokens
    }
  } finally {
    connection.release()
  }
}

// Main execution
async function main() {
  try {
    const testUser = await createTestUser()
    console.log('Test user created successfully:')
    console.log('------------------------------')
    console.log(`User ID: ${testUser.id}`)
    console.log(`Email: ${testUser.email}`)
    console.log(`Full Name: ${testUser.fullName}`)
    console.log(`API Key: ${testUser.apiKey}`)
    console.log('\nAuthentication Tokens:')
    console.log('------------------------------')
    console.log(`Access Token: ${testUser.tokens.accessToken}`)
    console.log(`Refresh Token: ${testUser.tokens.refreshToken}`)
    console.log(`Token ID: ${testUser.tokens.tokenId}`)
    console.log('\nExample Usage:')
    console.log('------------------------------')
    console.log('1. API Key Authentication:')
    console.log(`   curl -H "X-API-Key: ${testUser.apiKey}" http://localhost:3000/api/protected-route`)
    console.log('\n2. Cookie Authentication:')
    console.log(`   curl -H "Cookie: access_token=${testUser.tokens.accessToken}; refresh_token=${testUser.tokens.refreshToken}" http://localhost:3000/auth/me`)
  } catch (error) {
    console.error('Error creating test user:', error)
    process.exit(1)
  } finally {
    await mysqlPool.end()
  }
}

// Run the script
main() 