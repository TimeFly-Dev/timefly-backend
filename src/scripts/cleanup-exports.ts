import { clickhouseClient } from '../db/clickhouse'
import * as fs from 'node:fs'
import path from 'node:path'

const EXPORT_DIR = path.join(process.cwd(), 'exports')

interface ExpiredExport {
	user_id: number
	export_id: string
}

async function cleanupExpiredExports() {
	try {
		// Get list of expired exports from ClickHouse
		const query = `
            SELECT 
                user_id,
                toString(id) as export_id
            FROM export_events
            WHERE expires_at <= now64()
        `

		const result = await clickhouseClient.query({
			query,
			format: 'JSONEachRow'
		})

		const expiredExports = (await result.json()) as ExpiredExport[]

		// Log expired exports for tracking
		if (expiredExports.length > 0) {
			console.log(`Found ${expiredExports.length} expired exports to clean up`)

			// Optional: You could use this to update the status in ClickHouse
			const exportIds = expiredExports.map((exp) => exp.export_id)
			console.log(`Export IDs to clean up: ${exportIds.join(', ')}`)
		}

		// Delete expired files
		let deletedCount = 0
		for (const file of await fs.promises.readdir(EXPORT_DIR)) {
			const filePath = path.join(EXPORT_DIR, file)
			try {
				const content = await fs.promises.readFile(filePath, 'utf-8')
				const metadata = JSON.parse(content)

				if (metadata.expiresAt && new Date(metadata.expiresAt) <= new Date()) {
					await fs.promises.unlink(filePath)
					deletedCount++
					console.log(`Deleted expired export: ${file}`)
				}
			} catch (error) {
				console.error(`Error processing file ${file}:`, error)
			}
		}

		console.log(`Export cleanup completed. Deleted ${deletedCount} expired files`)

		// Optional: Update ClickHouse to mark these exports as cleaned up
		if (expiredExports.length > 0) {
			const updateQuery = `
                ALTER TABLE export_events
                UPDATE cleaned_up = 1
                WHERE id IN (${expiredExports.map((exp) => `'${exp.export_id}'`).join(',')})
            `

			await clickhouseClient.exec({
				query: updateQuery,
				clickhouse_settings: {
					async_insert: 1
				}
			})
		}
	} catch (error) {
		console.error('Error during export cleanup:', error)
	} finally {
		await clickhouseClient.close()
	}
}

// Run cleanup
cleanupExpiredExports()
