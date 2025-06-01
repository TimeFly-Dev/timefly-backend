/**
 * Enum for API key event types
 */
export enum ApiKeyEventType {
	Created = 1,
	Regenerated = 2
}

/**
 * Represents an API key event for logging
 */
export interface ApiKeyEventLog {
	readonly user_id: number
	readonly timestamp: Date
	readonly event_type: ApiKeyEventType
	readonly ip_address: string
	readonly user_agent: string
	readonly country_code: string
	readonly city: string
}

/**
 * Input for logging an API key event
 */
export interface ApiKeyEventInput {
	user_id: number
	timestamp: Date
	event_type: 'created' | 'regenerated' | 'revoked' | 'last_used'
	ip_address: string
	user_agent: string
	country_code?: string
	city?: string
	device_name?: string
	device_type?: string
	browser?: string
	os?: string
}

/**
 * Represents a daily API key event statistic
 */
export interface ApiKeyDailyStat {
	readonly user_id: number
	readonly date: string
	readonly event_type: ApiKeyEventType | string | number
	readonly event_count: number | string
}

/**
 * Response structure for API key statistics
 */
export interface ApiKeyStatsResponse {
	readonly success: boolean
	readonly data?: {
		readonly stats: readonly ApiKeyDailyStat[]
		readonly totalCreated: number
		readonly totalRegenerated: number
	}
	readonly error?: string
}
