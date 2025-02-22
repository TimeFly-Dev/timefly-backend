import { clickhouseClient } from '../db/clickhouse'
import { Resend } from 'resend'
import type { TimeEntry } from '../types/sync'
import { CONFIG } from '../config'
import * as fs from 'node:fs'
import path from 'node:path'

declare const self: {
	postMessage: (message: WorkerMessage) => void
	onmessage: ((event: MessageEvent<ExportJob>) => void) | null
}

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

// Ensure the export directory exists
if (!fs.existsSync(EXPORT_DIR)) {
	fs.mkdirSync(EXPORT_DIR, { recursive: true })
}

function formatFileName(userId: number, startDate?: string, endDate?: string): string {
	const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '') // Remove milliseconds

	const dateRange = startDate && endDate ? `_${startDate}_to_${endDate}` : '_all-time'

	return `user-${userId}${dateRange}_${timestamp}.json`
}

self.onmessage = async (event: MessageEvent<ExportJob>) => {
	const { userId, email, startDate, endDate } = event.data

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

		// Generate export file with new naming convention
		const exportData = {
			userId,
			exportDate: new Date().toISOString(),
			dateRange: {
				start: startDate || 'all-time',
				end: endDate || 'present'
			},
			entries: allEntries
		}

		const exportContent = JSON.stringify(exportData)
		const fileName = formatFileName(userId, startDate, endDate)
		const filePath = path.join(EXPORT_DIR, fileName)

		// Save the file locally
		fs.writeFileSync(filePath, exportContent)

		const fileSize = fs.statSync(filePath).size
		const downloadUrl = `${CONFIG.BASE_URL}/exports/download/${fileName}`

		console.log(`[${new Date().toISOString()}] Export file saved: ${filePath}`)

		// Prepare email content with improved formatting
		const emailHtml = `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>TimeFly Data Export</title>
				<style>
				body { 
					font-family: Arial, sans-serif;
					line-height: 1.6;
					color: #333;
					margin: 0;
					padding: 0;
				}
				.container {
					max-width: 600px;
					margin: 0 auto;
					padding: 20px;
				}
				.header {
					background-color: #2c3e50;
					color: white;
					padding: 20px;
					text-align: center;
					border-radius: 5px 5px 0 0;
				}
				h1 {
					margin: 0;
					font-size: 24px;
				}
				.content {
					padding: 20px;
					background-color: #ffffff;
				}
				.details {
					background-color: #f8f9fa;
					padding: 15px;
					border-radius: 5px;
					margin: 20px 0;
				}
				.download-link {
					background-color: #3498db;
					color: white;
					padding: 12px 20px;
					text-decoration: none;
					border-radius: 5px;
					display: inline-block;
					margin: 10px 0;
				}
				.download-link:hover {
					background-color: #2980b9;
				}
				.footer {
					margin-top: 20px;
					padding-top: 20px;
					border-top: 1px solid #eee;
					font-size: 0.9em;
					color: #7f8c8d;
				}
				</style>
			</head>
			<body>
				<div class="container">
				<div class="header">
					<h1>Your TimeFly Data Export is Ready</h1>
				</div>
				<div class="content">
					<p>Hello,</p>
					<p>Your TimeFly data export has been successfully generated. Here are the details:</p>
					<div class="details">
					<p><strong>Total entries:</strong> ${allEntries.length.toLocaleString()}</p>
					<p><strong>Export date:</strong> ${new Date().toLocaleString()}</p>
					<p><strong>Date range:</strong> ${startDate || 'All time'} to ${endDate || 'Present'}</p>
					<p><strong>File size:</strong> ${(fileSize / (1024 * 1024)).toFixed(2)} MB</p>
					</div>
					<p>Due to the large size of your export, we've saved it on our servers. You can download your data using the button below:</p>
					<p style="text-align: center;">
					<a href="${downloadUrl}" class="download-link">Download Export</a>
					</p>
					<p><small>This link will be available for the next 7 days.</small></p>
					<p>If you have any questions or need further assistance, please don't hesitate to contact our support team.</p>
					<div class="footer">
					<p>Best regards,<br>The TimeFly Team</p>
					</div>
				</div>
				</div>
			</body>
			</html>
		`

		// Send email with download link
		const { data, error } = await resend.emails.send({
			from: CONFIG.EMAIL_FROM,
			to: email,
			subject: 'Your TimeFly Data Export is Ready',
			html: emailHtml
		})

		if (error) {
			throw new Error(`Failed to send email: ${error.message}`)
		}

		console.log(`[${new Date().toISOString()}] Email sent successfully for user ${userId}. Email ID: ${data?.id}`)

		self.postMessage({
			type: 'complete',
			totalEntries: allEntries.length,
			downloadUrl
		})
	} catch (error) {
		console.error(`[${new Date().toISOString()}] Error in export process for user ${userId}:`, error)
		self.postMessage({
			type: 'error',
			error: error instanceof Error ? error.message : 'Unknown error occurred'
		})
	}
}

console.log(`[${new Date().toISOString()}] Export worker initialized`)
