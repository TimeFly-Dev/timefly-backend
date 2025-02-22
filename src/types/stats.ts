export interface CodingHours {
	date: string
	hours: string
}

export interface TotalCodingHours {
	start_date: string
	end_date: string
	total_hours: number
}

export type AggregationType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total'

export interface CodingStatsOptions {
	userId: number
	startDate?: string
	endDate?: string
	date?: string
	aggregation: AggregationType
}

export type ClickHouseResult = CodingHours | TotalCodingHours

export interface TopLanguageRaw {
	language: string
	total_seconds: number
	last_used: string
	last_project: string
}

export interface TopLanguage {
	language: string
	hours: string
	lastUsed: string
	lastProject: string
}

export interface TopLanguagesOptions {
	userId: number
	startDate?: string
	endDate?: string
	limit?: number
	period?: 'day' | 'week' | 'month' | 'year' | 'all'
}
