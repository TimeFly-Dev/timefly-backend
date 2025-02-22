import { clickhouseClient } from '../db/clickhouse'
import { CONFIG } from '@/config'

interface AuthLogEntry {
	timestamp: Date
	user_id: number
	email: string
	success: boolean
	ip_address: string
	user_agent: string
	country_code: string
	city: string
	provider: 'google' | 'github' | 'local'
	error_message?: string
}

class AuthLoggingService {
	private queue: AuthLogEntry[] = []
	private isProcessing = false

	async logAuth(entry: AuthLogEntry): Promise<void> {
		this.queue.push(entry)
		this.processQueue()
	}

	private async processQueue(): Promise<void> {
		if (this.isProcessing || this.queue.length === 0) {
			return
		}

		this.isProcessing = true

		try {
			const batch = this.queue.splice(0, CONFIG.AUTH_LOG_BATCH_SIZE)
			await this.insertBatch(batch)
		} catch (error) {
			console.error('Error processing auth log queue:', error)
		} finally {
			this.isProcessing = false
			if (this.queue.length > 0) {
				setTimeout(() => this.processQueue(), CONFIG.AUTH_LOG_PROCESS_INTERVAL)
			}
		}
	}

	private formatDate(date: Date): string {
		return date.toISOString().replace('T', ' ').replace('Z', '')
	}

	private async insertBatch(batch: AuthLogEntry[]): Promise<void> {
		const query = `
      INSERT INTO auth_logs 
      (timestamp, user_id, email, success, ip_address, user_agent, country_code, city, provider, error_message)
      VALUES
    `

		const values = batch
			.map(
				(entry) => `(
					'${this.formatDate(entry.timestamp)}',
					${entry.user_id},
					'${entry.email}',
					${entry.success ? 1 : 0},
					'${entry.ip_address}',
					'${entry.user_agent}',
					'${entry.country_code}',
					'${entry.city}',
					'${entry.provider}',
					'${entry.error_message || ''}'
				)`
			)
			.join(',')

		await clickhouseClient.exec({
			query: query + values,
			clickhouse_settings: {
				async_insert: 1
			}
		})
	}
}

export const authLoggingService = new AuthLoggingService()
