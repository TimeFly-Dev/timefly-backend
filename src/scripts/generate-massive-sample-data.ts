import { clickhouseClient } from '@/db/clickhouse'
import { mysqlPool } from '@/db/mysql'
import { faker } from '@faker-js/faker'
import { sign } from 'hono/jwt'
import { config } from '@/config'

const NUM_USERS = 100
const MAX_DAYS_OF_DATA = 365
const MAX_ACTIVITIES_PER_DAY = 50

const languages = ['javascript', 'typescript', 'python', 'java', 'c++', 'rust', 'go', 'ruby', 'php', 'swift']
const categories = ['coding', 'debugging', 'reading']
const operatingSystems = ['Windows', 'macOS', 'Linux']

interface UserStats {
	total_activities: number
	total_seconds: number
	first_activity: string
	last_activity: string
}

async function generateMassiveSampleData() {
	try {
		console.log('Starting massive sample data generation...')

		// Generate users
		console.log(`Generating ${NUM_USERS} users...`)
		const users = await generateUsers(NUM_USERS)
		console.log('Users generated successfully.')

		// Generate coding activities
		console.log('Generating coding activities...')
		const activities = await generateActivities(users)
		console.log(`Generated ${activities.length} activities.`)

		// Insert activities into ClickHouse
		console.log('Inserting activities into ClickHouse...')
		await insertActivities(activities)
		console.log('Activities inserted successfully.')

		// Generate and display user tokens
		console.log('Generating user tokens...')
		const userTokens = await generateUserTokens(users)

		// Display user information and tokens
		console.log('\nUser Information and Tokens:')
		for (const user of userTokens) {
			console.log(`----------------------------------------`)
			console.log(`User ID: ${user.id}`)
			console.log(`Email: ${user.email}`)
			console.log(`Total Activities: ${user.totalActivities}`)
			console.log(`Total Hours: ${user.totalHours.toFixed(2)}`)
			console.log(`First Activity: ${user.firstActivity}`)
			console.log(`Last Activity: ${user.lastActivity}`)
			console.log(`Token: ${user.token}`)
		}

		console.log('\nMassive sample data generation completed successfully.')
	} catch (error) {
		console.error('Error generating massive sample data:', error)
	} finally {
		await mysqlPool.end()
	}
}

async function generateUsers(count: number) {
	const users = []
	for (let i = 0; i < count; i++) {
		const [result] = await mysqlPool.execute<any>('INSERT INTO users (google_id, email, full_name, avatar_url) VALUES (?, ?, ?, ?)', [
			faker.string.uuid(),
			faker.internet.email(),
			faker.person.fullName(),
			faker.image.avatar()
		])
		users.push(result.insertId)
		console.log(`Generated user ${i + 1}/${count}`)
	}
	return users
}

async function generateActivities(userIds: number[]) {
	const activities = []
	const now = new Date()

	for (const userId of userIds) {
		const daysOfData = faker.number.int({ min: 30, max: MAX_DAYS_OF_DATA })
		let totalActivities = 0

		for (let day = 0; day < daysOfData; day++) {
			const activitiesForDay = faker.number.int({ min: 0, max: MAX_ACTIVITIES_PER_DAY })
			totalActivities += activitiesForDay

			for (let i = 0; i < activitiesForDay; i++) {
				const date = new Date(now.getTime() - day * 24 * 60 * 60 * 1000)
				const startTime = new Date(date.setHours(faker.number.int({ min: 0, max: 23 }), faker.number.int({ min: 0, max: 59 })))
				const endTime = new Date(startTime.getTime() + faker.number.int({ min: 1, max: 180 }) * 60 * 1000)

				activities.push({
					user_id: userId,
					entity: faker.system.filePath(),
					type: faker.helpers.arrayElement(['file', 'folder']),
					category: faker.helpers.arrayElement(categories),
					start_time: formatDateForClickHouse(startTime),
					end_time: formatDateForClickHouse(endTime),
					project: faker.word.sample() + '-project',
					branch: faker.git.branch(),
					language: faker.helpers.arrayElement(languages),
					dependencies: faker.helpers
						.arrayElements(['react', 'vue', 'angular', 'express', 'django', 'flask'], { min: 0, max: 3 })
						.join(','),
					machine_name_id: `${faker.word.adjective()}-${faker.word.noun()}-${faker.number.int({ min: 1, max: 100 })}`,
					os: faker.helpers.arrayElement(operatingSystems),
					line_additions: faker.number.int({ min: 0, max: 500 }),
					line_deletions: faker.number.int({ min: 0, max: 100 }),
					lines: faker.number.int({ min: 50, max: 1000 }),
					is_write: faker.datatype.boolean() ? 1 : 0
				})
			}
		}

		console.log(`Generated ${totalActivities} activities for user ${userId}`)
	}

	return activities
}

function formatDateForClickHouse(date: Date): string {
	return date.toISOString().slice(0, 19).replace('T', ' ')
}

async function insertActivities(activities: any[]) {
	const batchSize = 10000
	const totalBatches = Math.ceil(activities.length / batchSize)

	for (let i = 0; i < activities.length; i += batchSize) {
		const batch = activities.slice(i, i + batchSize)
		await clickhouseClient.insert({
			table: 'coding_activity',
			values: batch,
			format: 'JSONEachRow'
		})
		console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${totalBatches}`)
	}
}

async function generateUserTokens(userIds: number[]) {
	const userTokens = []

	for (const userId of userIds) {
		const [userResult] = await mysqlPool.execute<any>('SELECT * FROM users WHERE id = ?', [userId])
		const user = userResult[0]

		const statsResult = await clickhouseClient.query({
			query: `
        SELECT 
          COUNT(*) as total_activities,
          SUM(dateDiff('second', start_time, end_time)) as total_seconds,
          MIN(start_time) as first_activity,
          MAX(end_time) as last_activity
        FROM coding_activity
        WHERE user_id = ${userId}
      `,
			format: 'JSONEachRow'
		})

		const stats = (await statsResult.json()) as UserStats[]

		const token = await sign(
			{
				userId,
				exp: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
			},
			config.jwtSecret
		)

		userTokens.push({
			id: userId,
			email: user.email,
			totalActivities: stats[0].total_activities,
			totalHours: stats[0].total_seconds / 3600,
			firstActivity: stats[0].first_activity,
			lastActivity: stats[0].last_activity,
			token: token
		})
	}

	return userTokens
}

generateMassiveSampleData()
