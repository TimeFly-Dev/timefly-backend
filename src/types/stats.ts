export interface codingTime {
	date: string
	hours: string
}

export interface TotalcodingTimes {
	start_date: string
	end_date: string
	total_hours: number
}

export type AggregationType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total'

export interface codingTimeOptions {
	userId: number
	startDate?: string
	endDate?: string
	date?: string
	aggregation: AggregationType
}

export type ClickHouseResult = codingTime | TotalcodingTimes

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

export interface Pulse {
	date: string
	project: string
	language: string
	state: string
	duration: number
	start_time: string
	end_time: string
}

export interface PulsesOptions {
	userId: number
	startDate?: string
	endDate?: string
	timeRange: 'day' | 'week' | 'month'
	responseFormat?: 'default' | 'dashboard'
}

export interface DashboardTimelineItem {
	start: string
	end: string
	project: string
	time: number
}

export interface DashboardResponse {
	computed: Record<string, number>
	timeline: DashboardTimelineItem[]
}

export interface TopItemsProps {
	userId: number;
	timeRange?: TimeRange;
	entity?: Entity;
	startDate?: string;
	endDate?: string;
	limit?: number;
	[key: string]: unknown;
}

export interface RawResult {
	name: string;
	total_seconds: string | number;
	last_used: string;
	last_project?: string;
}

export interface TopItem {
	name: string;
	time: number;
	formattedTime: string;
	lastUsed: string;
	lastProject?: string;
}

export interface TopItemsResponse {
	timeRange: string;
	[key: string]: unknown;
}

export type Entity = 'languages' | 'ides' | 'projects' | 'machines';
export type TimeRange = 'day' | 'week' | 'month' | 'year' | 'all';
