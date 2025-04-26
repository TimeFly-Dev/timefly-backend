/**
 * Enum for session event types
 */
export enum SessionEventType {
	Created = 1,
	Refreshed = 2,
	Expired = 3,
	Revoked = 4
}

/**
 * Represents a user session
 */
export interface UserSession {
	readonly id: string
	readonly user_id: number
	readonly device_name: string
	readonly device_type: string
	readonly browser: string
	readonly os: string
	readonly ip_address: string
	readonly last_active: Date
	readonly expires_at: Date
	readonly is_revoked: boolean
	readonly created_at: Date
}

/**
 * Input for creating a user session
 */
export interface CreateSessionInput {
	readonly user_id: number
	readonly refresh_token: string
	readonly device_name?: string
	readonly device_type?: string
	readonly browser?: string
	readonly os?: string
	readonly ip_address: string
	readonly expires_at: Date
}

/**
 * Input for logging a session event
 */
export interface SessionEventInput {
	readonly session_id: string
	readonly user_id: number
	readonly timestamp: Date
	readonly event_type: 'created' | 'refreshed' | 'expired' | 'revoked'
	readonly ip_address: string
	readonly user_agent: string
	readonly device_name?: string
	readonly device_type?: string
	readonly browser?: string
	readonly os?: string
	readonly country_code?: string
	readonly city?: string
}

/**
 * Represents a daily session event statistic
 */
export interface SessionDailyStat {
	readonly user_id: number
	readonly date: string
	readonly event_type: SessionEventType
	readonly event_count: number
	readonly unique_ips: readonly string[]
	readonly device_types: readonly string[]
	readonly browsers: readonly string[]
	readonly operating_systems: readonly string[]
}

/**
 * Response structure for session statistics
 */
export interface SessionStatsResponse {
	readonly success: boolean
	readonly data?: {
		readonly stats: readonly SessionDailyStat[]
		readonly totalCreated: number
		readonly totalRefreshed: number
		readonly totalExpired: number
		readonly totalRevoked: number
		readonly uniqueDevices: number
	}
	readonly error?: string
}

/**
 * Response structure for user sessions
 */
export interface UserSessionsResponse {
	readonly success: boolean
	readonly data?: {
		readonly sessions: readonly UserSession[]
		readonly currentSession?: string
	}
	readonly error?: string
}
