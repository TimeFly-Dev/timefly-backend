import { clickhouseClient } from '../db/clickhouse'
import type { Pulse, AggregatedPulse, SyncData, SyncEventMetadata } from '../types/sync'

function isPulse(obj: Pulse | AggregatedPulse): obj is Pulse {
	return 'time' in obj && typeof obj.time === 'number'
}

export async function syncTimeEntries(
	userId: number,
	syncData: SyncData
): Promise<{
	pulsesCount: number
	aggregatedPulsesCount: number
	errors: string[]
}> {
	const pulses: Pulse[] = []
	const aggregatedPulses: AggregatedPulse[] = []
	const errors: string[] = []

	syncData.data.forEach((item) => {
		try {
			if (isPulse(item)) {
				pulses.push(item)
			} else {
				aggregatedPulses.push(item)
			}
		} catch (error) {
			errors.push(`Error processing entry: ${(error as Error).message}`)
		}
	})

	if (pulses.length > 0) {
		try {
			await syncPulses(userId, pulses, syncData.timezone)
		} catch (error) {
			errors.push(`Error syncing pulses: ${(error as Error).message}`)
		}
	}

	if (aggregatedPulses.length > 0) {
		try {
			await syncAggregatedPulses(userId, aggregatedPulses, syncData.timezone)
		} catch (error) {
			errors.push(`Error syncing aggregated pulses: ${(error as Error).message}`)
		}
	}

	return {
		pulsesCount: pulses.length,
		aggregatedPulsesCount: aggregatedPulses.length,
		errors
	}
}

async function syncPulses(userId: number, pulses: Pulse[], timezone: string): Promise<void> {
	if (pulses.length === 0) {
		return
	}

	const query = `
    INSERT INTO pulses 
      (user_id, entity, type, state, time, project, project_root_count, branch, language, 
       dependencies, machine_name_id, line_additions, line_deletions, lines, lineno, 
       cursorpos, is_write, timezone)
    VALUES
  `

	const values = pulses
		.map(
			(pulse) => `(
        ${userId},
        '${escapeString(pulse.entity)}',
        '${pulse.type}',
        '${pulse.state}',
        toDateTime64(${pulse.time / 1000}, 3),
        '${escapeString(pulse.project || '')}',
        ${pulse.project_root_count},
        '${escapeString(pulse.branch || '')}',
        '${escapeString(pulse.language || '')}',
        '${escapeString(pulse.dependencies || '')}',
        '${escapeString(pulse.machine_name_id)}',
        ${pulse.line_additions || 0},
        ${pulse.line_deletions || 0},
        ${pulse.lines},
        ${pulse.lineno || 0},
        ${pulse.cursorpos || 0},
        ${pulse.is_write ? 1 : 0},
        '${escapeString(timezone)}'
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

async function syncAggregatedPulses(userId: number, aggregatedPulses: AggregatedPulse[], timezone: string): Promise<void> {
	if (aggregatedPulses.length === 0) {
		return
	}

	const query = `
    INSERT INTO aggregated_pulses 
      (user_id, entity, type, state, start_time, end_time, project, branch, language, 
       dependencies, machine_name_id, line_additions, line_deletions, lines, is_write, timezone)
    VALUES
  `

	const values = aggregatedPulses
		.map(
			(pulse) => `(
        ${userId},
        '${escapeString(pulse.entity)}',
        '${pulse.type}',
        '${pulse.state}',
        toDateTime64(${pulse.start_time / 1000}, 3),
        toDateTime64(${pulse.end_time / 1000}, 3),
        '${escapeString(pulse.project || '')}',
        '${escapeString(pulse.branch || '')}',
        '${escapeString(pulse.language || '')}',
        '${escapeString(pulse.dependencies || '')}',
        '${escapeString(pulse.machine_name_id)}',
        ${pulse.line_additions},
        ${pulse.line_deletions},
        ${pulse.lines},
        ${pulse.is_write ? 1 : 0},
        '${escapeString(timezone)}'
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
	pulsesCount: number,
	aggregatedPulsesCount: number,
	syncDuration: number,
	success: boolean,
	errorMessage = '',
	metadata?: SyncEventMetadata
): Promise<void> {
	const query = `
    INSERT INTO sync_events 
    (user_id, timestamp, machine_name_id, pulses_count, aggregated_pulses_count, sync_duration_ms, success, error_message, request_id, timezone, user_agent, ip_address)
    VALUES 
    (
      ${userId}, 
      now64(), 
      'server', 
      ${pulsesCount}, 
      ${aggregatedPulsesCount}, 
      ${syncDuration}, 
      ${success ? 1 : 0}, 
      '${escapeString(errorMessage)}',
      '${metadata?.requestId || ''}',
      '${metadata?.timezone || ''}',
      '${metadata?.userAgent ? escapeString(metadata.userAgent) : ''}',
      '${metadata?.ipAddress ? escapeString(metadata.ipAddress) : ''}'
    )
  `

	await clickhouseClient.exec({
		query,
		clickhouse_settings: {
			async_insert: 1
		}
	})
}

function escapeString(str: string): string {
	if (!str) {
		return ''
	}
	return str.replace(/'/g, "\\'").replace(/\n/g, '\\n')
}
