export function formatDuration(hours: number): string {
	const totalSeconds = Math.round(hours * 3600)
	const h = Math.floor(totalSeconds / 3600)
	const m = Math.floor((totalSeconds % 3600) / 60)
	const s = totalSeconds % 60

	return `${h}h ${m}m ${s}s`
}

export function formatDateRange(startDate: string, endDate: string): string {
	const start = new Date(startDate)
	const end = new Date(endDate)

	const formatDate = (date: Date) => {
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	}

	return `${formatDate(start)} to ${formatDate(end)}`
}

/**
 * Formats a Date object into a string compatible with ClickHouse's toDateTime function
 * @param {Date} date - The date to format
 * @returns {string} A formatted date string
 */
export function formatDateForClickHouse(date: Date): string {
	const year = date.getUTCFullYear()
	const month = String(date.getUTCMonth() + 1).padStart(2, '0')
	const day = String(date.getUTCDate()).padStart(2, '0')
	const hours = String(date.getUTCHours()).padStart(2, '0')
	const minutes = String(date.getUTCMinutes()).padStart(2, '0')
	const seconds = String(date.getUTCSeconds()).padStart(2, '0')

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}
