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
