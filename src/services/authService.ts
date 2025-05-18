import { logger } from '../utils/logger'
import { sessionService } from './sessionService'
import { authEventService } from './authEventService'
import { parseUserAgent } from '../utils/deviceDetection'
import type { CreateSessionInput } from '../types/sessions'
import type { ClientInfo } from '../types/auth'
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyAccessToken as verifyToken, 
  verifyRefreshTokenPayload 
} from '../utils/tokenUtils'

/**
 * Client information interface for session tracking
 */
// interface ClientInfo {
//   ipAddress: string
//   userAgent: string
// }

/**
 * Generates JWT tokens for authentication
 * @param dbUser - The user data
 * @param clientInfo - Client information for session tracking
 * @returns Object containing access and refresh tokens
 */
export async function generateTokens(
  dbUser: {
    id: number
    email: string
    fullName: string
    avatarUrl: string
  },
  clientInfo: ClientInfo
): Promise<{
  accessToken: string
  refreshToken: string
  tokenId: string
}> {
  const accessToken = await generateAccessToken(dbUser.id)
  const { token: refreshToken, tokenId } = await generateRefreshToken()

  // Parse user agent for session details
  const userAgent = parseUserAgent(clientInfo.userAgent)

  // Create session in database
  const sessionData: CreateSessionInput = {
    user_id: dbUser.id,
    refresh_token: tokenId,
    ip_address: clientInfo.ipAddress,
    device_name: userAgent.deviceName,
    device_type: userAgent.deviceType,
    browser: userAgent.browser,
    os: userAgent.os,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }

  await sessionService.createSession(sessionData)

  // Log successful authentication
  authEventService.logEvent({
    timestamp: new Date(),
    user_id: dbUser.id,
    email: dbUser.email,
    success: true,
    ip_address: clientInfo.ipAddress,
    user_agent: clientInfo.userAgent,
    country_code: 'UN',
    city: 'Unknown',
    provider: 'google',
    event_type: 'created',
    device_info: {
      device_name: userAgent.deviceName,
      device_type: userAgent.deviceType,
      browser: userAgent.browser,
      os: userAgent.os
    }
  })

  return { accessToken, refreshToken, tokenId }
}

/**
 * Verifies an access token and returns the user ID
 * @param token - The JWT access token to verify
 * @returns The user ID from the token
 */
export async function verifyAccessToken(token: string): Promise<number> {
  return verifyToken(token)
}

/**
 * Verifies a refresh token and returns the user ID and token ID
 * @param token - The JWT refresh token to verify
 * @returns Object containing user ID and token ID
 */
export async function verifyRefreshToken(token: string): Promise<{ userId: number; tokenId: string }> {
  try {
    const { tokenId } = await verifyRefreshTokenPayload(token)
    
    // Get session from database using token
    const session = await sessionService.getSessionByRefreshToken(tokenId)
    
    // Check if session exists and is not revoked
    if (!session) {
      throw new Error('Session not found')
    }
    
    // Check if token has expired
    if (session.expires_at && new Date() > new Date(session.expires_at)) {
      throw new Error('Refresh token has expired')
    }
    
    return { userId: session.user_id, tokenId }
  } catch (error) {
    logger.error('Refresh token verification failed:', error)
    throw new Error('Invalid or expired refresh token')
  }
}

/**
 * Revokes a refresh token
 * @param tokenId - The ID of the token to revoke
 * @returns Promise that resolves when the token is revoked
 */
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  try {
    // Get the session first to ensure it exists
    const session = await sessionService.getSessionByRefreshToken(tokenId)
    if (session?.id) {
      // Pass the session ID as a string and the user ID as a number
      await sessionService.revokeSession(session.id, session.user_id)
    }
  } catch (error) {
    logger.error('Failed to revoke refresh token:', error)
    throw new Error('Failed to revoke refresh token')
  }
}

/**
 * Revokes all refresh tokens for a user
 * @param userId - The ID of the user
 * @returns Promise that resolves when all tokens are revoked
 */
export async function revokeAllUserSessions(userId: number): Promise<void> {
  try {
    // Get all user sessions
    const sessions = await sessionService.getUserSessions(userId)
    
    // Revoke each session
    for (const session of sessions) {
      try {
        await sessionService.revokeSession(session.id, userId)
      } catch (error) {
        logger.error(`Failed to revoke session ${session.id}:`, error)
        // Continue with other sessions even if one fails
      }
    }
  } catch (error) {
    logger.error('Failed to revoke user sessions:', error)
    throw new Error('Failed to revoke user sessions')
  }
}

