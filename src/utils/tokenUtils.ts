import { sign, verify } from 'hono/jwt'
import { CONFIG } from '../config'
import { logger } from './logger'
import { randomUUID } from 'node:crypto'

/**
 * Generates a new access token
 * @param userId - The user ID
 * @returns Promise with the generated access token
 */
export async function generateAccessToken(userId: number): Promise<string> {
  return sign(
    { userId },
    CONFIG.JWT_ACCESS_SECRET,
    'HS256'
  )
}

/**
 * Generates a new refresh token with a unique identifier
 * @returns Object containing the refresh token and its ID
 */
export async function generateRefreshToken(): Promise<{ token: string; tokenId: string }> {
  const tokenId = randomUUID()
  const token = await sign(
    { tokenId },
    CONFIG.JWT_REFRESH_SECRET,
    'HS256'
  )
  return { token, tokenId }
}

/**
 * Verifies an access token and returns the user ID
 * @param token - The JWT access token to verify
 * @returns The user ID from the token
 */
export async function verifyAccessToken(token: string): Promise<number> {
  try {
    const payload = await verify(token, CONFIG.JWT_ACCESS_SECRET, 'HS256')
    return payload.userId as number
  } catch (error) {
    logger.error('Access token verification failed:', error)
    throw new Error('Invalid or expired access token')
  }
}

/**
 * Verifies a refresh token and returns the token ID
 * @param token - The JWT refresh token to verify
 * @returns The token ID from the token
 */
export async function verifyRefreshTokenPayload(token: string): Promise<{ tokenId: string }> {
  try {
    const payload = await verify(token, CONFIG.JWT_REFRESH_SECRET, 'HS256')
    if (!payload.tokenId) {
      throw new Error('Invalid token payload')
    }
    return { tokenId: payload.tokenId as string }
  } catch (error) {
    logger.error('Refresh token verification failed:', error)
    throw new Error('Invalid or expired refresh token')
  }
}
