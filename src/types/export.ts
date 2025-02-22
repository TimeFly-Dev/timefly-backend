export interface ExportJob {
	userId: number
	email: string
	startDate?: string
	endDate?: string
}

export interface ExportWorkerMessage {
	type: 'progress' | 'complete' | 'error'
	processed?: number
	totalEntries?: number
	error?: string
	downloadUrl?: string
}

export interface ExportFile {
	filename: string
	url: string
	createdAt: string
}

export interface ExportListResponse {
	success: boolean
	data?: ExportFile[]
	error?: string
}
