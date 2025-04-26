export interface ApiKey {
	id: number
	userId: number
	apiKey: string
	createdAt: Date
	lastUsedAt: Date | null
}

export interface ApiKeyResponse {
	success: boolean
	data?: {
		apiKey: string
	}
	error?: string
}
