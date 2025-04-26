/**
 * Enum for authentication event types
 */
export enum AuthEventType {
	Login = 1,
	Logout = 2,
	TokenRefresh = 3,
	Failed = 4,
	SessionCreated = 5,
	SessionRefreshed = 6,
	SessionExpired = 7,
	SessionRevoked = 8
}

/**
 * Enum for authentication providers
 */
export enum AuthProvider {
	Google = 1,
	Github = 2,
	Local = 3
}

/**
 * Represents an authentication event for logging
 */
export interface AuthEventLog {
	readonly user_id: number
	readonly timestamp: Date
	readonly email: string
	readonly success: boolean
	readonly ip_address: string
	readonly user_agent: string
	readonly country_code: string
	readonly city: string
	readonly provider: AuthProvider
	readonly error_message?: string
	readonly session_id?: string
	readonly event_type?: AuthEventType
	readonly device_info?: {
		readonly device_name: string
		readonly device_type: string
		readonly browser: string
		readonly os: string
	}
}

/**
 * Input for logging an authentication event
 */
export interface AuthEventInput {
	readonly timestamp: Date
	readonly user_id: number
	readonly email: string
	readonly success: boolean
	readonly ip_address: string
	readonly user_agent: string
	readonly country_code: string
	readonly city: string
	readonly provider: 'google' | 'github' | 'local'
	readonly error_message?: string
	readonly session_id?: string
	readonly event_type?: 'created' | 'refreshed' | 'expired' | 'revoked'
	readonly device_info?: {
		readonly device_name: string
		readonly device_type: string
		readonly browser: string
		readonly os: string
	}
}

/**
 * Represents a daily authentication event statistic
 */
export interface AuthDailyStat {
	readonly user_id: number
	readonly date: string
	readonly success: boolean
	readonly attempts: number
	readonly unique_ips: readonly string[]
	readonly unique_user_agents: readonly string[]
	readonly countries: readonly string[]
	readonly device_types?: readonly string[]
	readonly browsers?: readonly string[]
	readonly operating_systems?: readonly string[]
	readonly event_type?: number
}

/**
 * Response structure for authentication statistics
 */
export interface AuthStatsResponse {
	readonly success: boolean
	readonly data?: {
		readonly stats: readonly AuthDailyStat[]
		readonly totalSuccess: number
		readonly totalFailure: number
		readonly uniqueIPs: number
		readonly uniqueCountries: number
		readonly uniqueDevices?: number
	}
	readonly error?: string
}
