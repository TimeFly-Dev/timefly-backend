import { clickhouseClient } from '../db/clickhouse'
import type { TimeEntry } from '../types/sync'

export async function syncTimeEntries(userId: number, timeEntries: TimeEntry[]): Promise<void> {
	const query = `
        INSERT INTO time_entries 
            (user_id, entity, type, category, start_time, end_time, project, branch, language, dependencies, machine_name_id, line_additions, line_deletions, lines, is_write)
        VALUES
    `

	const values = timeEntries
		.map(
			(entry) => `(
                ${userId},
                '${entry.entity}',
                '${entry.type}',
                '${entry.category}',
                toDateTime64(${entry.start_time / 1000}, 3),
                toDateTime64(${entry.end_time / 1000}, 3),
                '${entry.project}',
                '${entry.branch}',
                '${entry.language}',
                '${entry.dependencies}',
                '${entry.machine_name_id}',
                ${entry.line_additions},
                ${entry.line_deletions},
                ${entry.lines},
                ${entry.is_write ? 1 : 0}
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

export async function logSyncEvent(
	userId: number,
	entriesCount: number,
	syncDuration: number,
	success: boolean,
	errorMessage = ''
): Promise<void> {
	const query = `
        INSERT INTO sync_events 
        (user_id, timestamp, machine_name_id, entries_count, sync_duration_ms, success, error_message)
        VALUES 
        (${userId}, now64(), 'server', ${entriesCount}, ${syncDuration}, ${success ? 1 : 0}, '${errorMessage}')
    `

	await clickhouseClient.exec({
		query,
		clickhouse_settings: {
			async_insert: 1
		}
	})
}
