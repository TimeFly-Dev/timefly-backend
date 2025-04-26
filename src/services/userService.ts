import { mysqlPool } from '@/db/mysql'
import type mysql from 'mysql2/promise'
import { createApiKey } from './apiKeyService'
import type { DbUser } from '@/types/auth'

export async function createUser(user: Omit<DbUser, 'id'>): Promise<DbUser> {
	const connection = await mysqlPool.getConnection()

	try {
		const [result] = await connection.execute<mysql.ResultSetHeader>(
			'INSERT INTO users (google_id, email, full_name, avatar_url) VALUES (?, ?, ?, ?)',
			[user.googleId, user.email, user.fullName, user.avatarUrl]
		)

		const userId = result.insertId

		// Generate API key for the new user
		await createApiKey(userId)

		return { id: userId, ...user }
	} finally {
		connection.release()
	}
}

export async function getUserByGoogleId(googleId: string): Promise<DbUser | null> {
	const [rows] = await mysqlPool.execute<mysql.RowDataPacket[]>(
		'SELECT id, google_id, email, full_name, avatar_url FROM users WHERE google_id = ?',
		[googleId]
	)
	const user = rows[0]
	return user
		? {
				id: user.id,
				googleId: user.google_id,
				email: user.email,
				fullName: user.full_name,
				avatarUrl: user.avatar_url
			}
		: null
}

export async function getUserById(id: number): Promise<DbUser> {
	const [rows] = await mysqlPool.execute<mysql.RowDataPacket[]>(
		'SELECT id, google_id, email, full_name, avatar_url FROM users WHERE id = ?',
		[id]
	)
	const user = rows[0]
	return {
		id: user.id || 0,
		googleId: user.google_id || '',
		email: user.email || '',
		fullName: user.full_name || '',
		avatarUrl: user.avatar_url || ''
	}
}

export async function updateUser(id: number, updates: { email: string; fullName: string; avatarUrl: string }): Promise<void> {
	await mysqlPool.execute('UPDATE users SET email = ?, full_name = ?, avatar_url = ? WHERE id = ?', [
		updates.email,
		updates.fullName,
		updates.avatarUrl,
		id
	])
}
