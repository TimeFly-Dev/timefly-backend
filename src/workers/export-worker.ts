import { clickhouseClient } from '../db/clickhouse'
import { Resend } from 'resend'
import type { TimeEntry } from '../types/sync'
import { CONFIG } from '../config'
import * as fs from 'node:fs'
import path from 'node:path'
import { getExportEmailTemplate } from '../templates/export-email'

declare const self: {
	postMessage: (message: WorkerMessage) => void
	onmessage: ((event: MessageEvent<ExportJob>) => void) | null
}

const EXPORT_EXPIRATION_DAYS = 7
const BATCH_SIZE = 1000
const EXPORT_DIR = path.join(process.cwd(), 'exports')
const resend = new Resend(CONFIG.RESEND_API_KEY)

interface ExportJob {
	userId: number
	email: string
	startDate?: string
	endDate?: string
}

interface WorkerMessage {
	type: 'progress' | 'complete' | 'error'
	processed?: number
	totalEntries?: number
	error?: string
	downloadUrl?: string
}

interface ExportMetrics {
	entriesCount: number
	fileSize: number
	processingTime: number
	error?: string
}

// Ensure the export directory exists
if (!fs.existsSync(EXPORT_DIR)) {
	fs.mkdirSync(EXPORT_DIR, { recursive: true })
}

function formatFileName(userId: number, startDate?: string, endDate?: string): string {
	const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '') // Remove milliseconds

	const dateRange = startDate && endDate ? `_${startDate}_to_${endDate}` : '_all-time'

	return `user-${userId}${dateRange}_${timestamp}.json`
}

async function logExportEvent(userId: number, metrics: ExportMetrics, startDate?: string, endDate?: string, emailSent = true) {
	const query = `
    INSERT INTO export_events (
      user_id,
      timestamp,
      entries_count,
      file_size_bytes,
      processing_time_ms,
      start_date,
      end_date,
      expires_at,
      email_sent,
      error_message
    )
    VALUES (
      ${userId},
      now64(),
      ${metrics.entriesCount},
      ${metrics.fileSize},
      ${metrics.processingTime},
      ${startDate ? `parseDateTime64BestEffort('${startDate}')` : 'NULL'},
      ${endDate ? `parseDateTime64BestEffort('${endDate}')` : 'NULL'},
      now64() + INTERVAL ${EXPORT_EXPIRATION_DAYS} DAY,
      ${emailSent ? 1 : 0},
      '${metrics.error || ''}'
    )
  `

	await clickhouseClient.exec({
		query,
		clickhouse_settings: {
			async_insert: 1
		}
	})
}

self.onmessage = async (event: MessageEvent<ExportJob>) => {
	const { userId, email, startDate, endDate } = event.data
	const startTime = Date.now()
	const metrics: ExportMetrics = {
		entriesCount: 0,
		fileSize: 0,
		processingTime: 0,
		error: undefined
	}

	console.log(`[${new Date().toISOString()}] Worker started for user ${userId}`)

	try {
		let offset = 0
		const allEntries: TimeEntry[] = []

		console.log(`[${new Date().toISOString()}] Starting data fetch for user ${userId}`)

		// Query in batches
		while (true) {
			let query = `
        SELECT 
          entity,
          type,
          category,
          start_time,
          end_time,
          project,
          branch,
          language,
          dependencies,
          machine_name_id,
          line_additions,
          line_deletions,
          lines,
          is_write
        FROM time_entries
        WHERE user_id = ${userId}
      `

			if (startDate) {
				query += ` AND start_time >= toDateTime('${startDate}')`
			}
			if (endDate) {
				query += ` AND end_time <= toDateTime('${endDate}')`
			}

			query += `
        ORDER BY start_time
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
      `

			const result = await clickhouseClient.query({
				query,
				format: 'JSONEachRow'
			})

			const batch: TimeEntry[] = await result.json()

			if (batch.length === 0) {
				break
			}

			allEntries.push(...batch)
			offset += BATCH_SIZE

			console.log(`[${new Date().toISOString()}] Fetched ${allEntries.length} entries for user ${userId}`)

			self.postMessage({
				type: 'progress',
				processed: allEntries.length
			})
		}

		console.log(`[${new Date().toISOString()}] Data fetch completed for user ${userId}. Total entries: ${allEntries.length}`)

		// Update metrics before saving file
		metrics.entriesCount = allEntries.length

		const exportData = {
			userId,
			exportDate: new Date().toISOString(),
			dateRange: {
				start: startDate || 'all-time',
				end: endDate || 'present'
			},
			entries: allEntries
		}

		// Save file with expiration
		const expirationDate = new Date()
		expirationDate.setDate(expirationDate.getDate() + EXPORT_EXPIRATION_DAYS)

		const metadata = {
			expiresAt: expirationDate.toISOString(),
			...exportData
		}

		const exportContent = JSON.stringify(metadata)
		const fileName = formatFileName(userId, startDate, endDate)
		const filePath = path.join(EXPORT_DIR, fileName)

		// Write file and update metrics
		fs.writeFileSync(filePath, exportContent)
		metrics.fileSize = fs.statSync(filePath).size

		const downloadUrl = `${CONFIG.BASE_URL}/exports/download/${fileName}`

		console.log(`[${new Date().toISOString()}] Export file saved: ${filePath}`)

		const emailHtml = getExportEmailTemplate({
			allEntries,
			downloadUrl,
			startDate,
			endDate,
			expirationDate,
			fileSize: metrics.fileSize
		})

		// Send email and log event
		const { data, error } = await resend.emails.send({
			from: CONFIG.EMAIL_FROM,
			to: email,
			subject: 'Your TimeFly Data Export is Ready',
			html: emailHtml
		})

		if (error) {
			throw new Error(`Failed to send email: ${error.message}`)
		}

		// Calculate final metrics
		metrics.processingTime = Date.now() - startTime

		// Log export event
		await logExportEvent(userId, metrics, startDate, endDate)

		console.log(`[${new Date().toISOString()}] Email sent successfully for user ${userId}. Email ID: ${data?.id}`)

		self.postMessage({
			type: 'complete',
			totalEntries: allEntries.length,
			downloadUrl
		})
	} catch (error) {
		console.error(`[${new Date().toISOString()}] Error in export process for user ${userId}:`, error)

		metrics.processingTime = Date.now() - startTime
		metrics.error = error instanceof Error ? error.message : 'Unknown error occurred'

		// Log failed export
		await logExportEvent(userId, metrics, startDate, endDate, false)

		self.postMessage({
			type: 'error',
			error: metrics.error
		})
	}
}

console.log(`[${new Date().toISOString()}] Export worker initialized`)
