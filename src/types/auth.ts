export interface GoogleUserResponse {
	id: string
	email: string
	name: string
	picture?: string
}

export interface DbUser {
	id: number
	googleId: string
	email: string
	fullName: string
	avatarUrl: string
}

export interface ClientInfo {
  ipAddress: string
  userAgent: string
}

export interface UserContext {
	id: number
	email: string
	fullName: string
	avatarUrl: string
}

declare module 'hono' {
	interface ContextVariableMap {
		userId: number
		user: UserContext
	}
}
