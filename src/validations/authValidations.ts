import { z } from 'zod'
import 'zod-openapi/extend'

export const googleCallbackSchema = z
	.object({
		success: z.boolean().describe('Indicates if the authentication was successful'),
		data: z
			.object({
				accessToken: z.string().describe('JWT access token'),
				refreshToken: z.string().describe('JWT refresh token'),
				user: z.object({
					id: z.number().describe('User ID'),
					email: z.string().email().describe('User email'),
					fullName: z.string().describe('User full name'),
					avatarUrl: z.string().url().optional().describe('User avatar URL')
				})
			})
			.optional(),
		error: z.string().optional().describe('Error message if authentication failed')
	})
	.openapi({ ref: 'GoogleCallbackResponse' })

export const refreshTokenSchema = z
	.object({
		refreshToken: z.string().describe('Refresh token for obtaining new tokens')
	})
	.openapi({ ref: 'RefreshTokenInput' })

export const tokenResponseSchema = z
	.object({
		success: z.boolean().describe('Indicates if the token refresh was successful'),
		data: z
			.object({
				accessToken: z.string().describe('New JWT access token'),
				refreshToken: z.string().describe('New JWT refresh token')
			})
			.optional(),
		error: z.string().optional().describe('Error message if token refresh failed')
	})
	.openapi({ ref: 'TokenResponse' })

export const errorResponseSchema = z
	.object({
		success: z.boolean().describe('Indicates if the operation was successful'),
		error: z.string().describe('Error message')
	})
	.openapi({ ref: 'ErrorResponse' })
