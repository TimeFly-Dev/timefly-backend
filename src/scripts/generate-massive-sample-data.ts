import { clickhouseClient } from '../db/clickhouse'

type Language = 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'rust' | 'cpp' | 'csharp' | 'ruby' | 'php'

interface TimeEntry {
	entity: string
	type: 'file' | 'folder'
	category: 'coding' | 'reading' | 'debugging'
	start_time: number
	end_time: number
	project: string
	branch: string
	language: Language
	dependencies: string
	machine_name_id: string
	line_additions: number
	line_deletions: number
	lines: number
	is_write: boolean
}

const projects = ['timefly', 'portfolio', 'e-commerce', 'blog', 'api-service', 'mobile-app', 'data-analytics']
const branches = ['main', 'develop', 'feature/auth', 'feature/dashboard', 'bugfix/login', 'refactor/core', 'optimize/performance']
const languages: Language[] = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp', 'csharp', 'ruby', 'php']
const fileExtensions: Record<Language, string> = {
	typescript: '.ts',
	javascript: '.js',
	python: '.py',
	java: '.java',
	go: '.go',
	rust: '.rs',
	cpp: '.cpp',
	csharp: '.cs',
	ruby: '.rb',
	php: '.php'
}
const dependencies = ['react', 'express', 'lodash', 'axios', 'moment', 'vue', 'angular', 'django', 'flask', 'spring']

function randomChoice<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateTimeEntry(userId: number, baseTime: number): TimeEntry {
	const project = randomChoice(projects)
	const language = randomChoice(languages)
	const duration = randomInt(60000, 7200000) // 1 minute to 2 hours
	const startTime = baseTime + randomInt(0, 3600000) // 0 to 1 hour offset
	const endTime = startTime + duration

	return {
		entity: `src/${project}/${randomChoice(['components', 'services', 'utils', 'models', 'controllers'])}/${randomChoice(['index', 'main', 'helper', 'utils', 'types', 'constants'])}${fileExtensions[language]}`,
		type: 'file',
		category: randomChoice(['coding', 'reading', 'debugging']),
		start_time: startTime,
		end_time: endTime,
		project,
		branch: randomChoice(branches),
		language,
		dependencies: randomChoice(dependencies),
		machine_name_id: `machine-${userId}-${randomChoice(['work', 'home', 'laptop'])}`,
		line_additions: randomInt(0, 200),
		line_deletions: randomInt(0, 100),
		lines: randomInt(100, 2000),
		is_write: Math.random() < 0.7 // 70% chance of being a write operation
	}
}

async function generateMassiveSampleData(userId: number, days = 730): Promise<void> {
	console.log(`Starting massive sample data generation for user ${userId} over ${days} days...`)

	const now = Date.now()
	const startDate = now - days * 24 * 60 * 60 * 1000
	const entries: TimeEntry[] = []
	const batchSize = 10000 // Insert in batches of 10,000 entries
	let totalEntries = 0

	for (let day = 0; day < days; day++) {
		const baseTime = startDate + day * 24 * 60 * 60 * 1000
		const dailyEntries = randomInt(50, 200) // 50 to 200 entries per day

		for (let i = 0; i < dailyEntries; i++) {
			entries.push(generateTimeEntry(userId, baseTime))
		}

		totalEntries += dailyEntries

		if (entries.length >= batchSize) {
			await insertBatch(userId, entries)
			entries.length = 0 // Clear the array
			console.log(`Inserted ${totalEntries} entries so far...`)
		}

		if (day % 30 === 0) {
			console.log(`Processed ${day} days...`)
		}
	}

	// Insert any remaining entries
	if (entries.length > 0) {
		await insertBatch(userId, entries)
		totalEntries += entries.length
	}

	console.log(`Finished generating ${totalEntries} sample time entries for user ${userId} over ${days} days.`)
}

async function insertBatch(userId: number, entries: TimeEntry[]): Promise<void> {
	const query = `
    INSERT INTO time_entries 
    (user_id, entity, type, category, start_time, end_time, project, branch, language, dependencies, machine_name_id, line_additions, line_deletions, lines, is_write)
    VALUES
  `

	const values = entries
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

	try {
		await clickhouseClient.exec({
			query: query + values,
			clickhouse_settings: {
				async_insert: 1
			}
		})
	} catch (error) {
		console.error('Error inserting batch:', error)
	}
}

// Get userId from command line argument
const userId = Number.parseInt(process.argv[2], 10)

if (Number.isNaN(userId)) {
	console.error('Please provide a valid user ID as an argument.')
	console.error('Usage: bun run generate-massive-data <userId> [days]')
	process.exit(1)
}

// Optional: Get number of days from command line argument
const days = Number.parseInt(process.argv[3], 10) || 730

console.log(`Generating massive sample data for user ${userId} over ${days} days...`)

generateMassiveSampleData(userId, days)
	.then(() => {
		console.log('Sample data generation completed successfully.')
		process.exit(0)
	})
	.catch((error) => {
		console.error('Error generating sample data:', error)
		process.exit(1)
	})
