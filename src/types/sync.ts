export type ActivityState = 'coding' | 'debugging'
export type EntityType = 'file' | 'app' | 'domain'

export interface Pulse {
	entity: string
	type: EntityType
	state: ActivityState
	time: number
	project?: string
	project_root_count: number
	branch?: string
	language?: string
	dependencies?: string
	machine_name_id: string
	line_additions?: number
	line_deletions?: number
	lines: number
	lineno?: number
	cursorpos?: number
	is_write: boolean
}

export interface AggregatedPulse {
	entity: string
	type: EntityType
	state: ActivityState
	start_time: number
	end_time: number
	project?: string
	branch?: string
	language?: string
	dependencies?: string
	machine_name_id: string
	line_additions: number
	line_deletions: number
	lines: number
	is_write: boolean
}

export interface SyncData {
	data: Array<Pulse | AggregatedPulse>
	start: string
	end: string
	timezone: string
}

export interface SyncResponse {
	success: boolean
	message: string
	syncedCount?: number
	errors?: string[]
}

export interface SyncEventMetadata {
	requestId: string
	timezone: string
	userAgent?: string
	ipAddress?: string
}
