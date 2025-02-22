export interface TimeEntry {
	entity: string
	type: 'file' | 'folder'
	category: 'coding' | 'reading' | 'debugging'
	start_time: number
	end_time: number
	project: string
	branch: string
	language: string
	dependencies: string
	machine_name_id: string
	line_additions: number
	line_deletions: number
	lines: number
	is_write: boolean
}

export interface SyncData {
	data: TimeEntry[]
	start: string
	end: string
	timezone: string
}
