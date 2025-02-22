import { mysqlPool } from '@/db/mysql'
import type mysql from 'mysql2/promise'

interface User {
	id: number
	googleId: string
	email: string
	fullName: string
	avatarUrl: string
}

export async function createUser(user: Omit<User, 'id'>): Promise<User> {
	const [result] = await mysqlPool.execute<mysql.ResultSetHeader>(
		'INSERT INTO users (google_id, email, full_name, avatar_url) VALUES (?, ?, ?, ?)',
		[user.googleId, user.email, user.fullName, user.avatarUrl]
	)
	const insertId = result.insertId
	return { id: insertId, ...user }
}

export async function getUserByGoogleId(googleId: string): Promise<User | null> {
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

export async function updateUser(id: number, updates: { email: string; fullName: string; avatarUrl: string }): Promise<void> {
	await mysqlPool.execute('UPDATE users SET email = ?, full_name = ?, avatar_url = ? WHERE id = ?', [
		updates.email,
		updates.fullName,
		updates.avatarUrl,
		id
	])
}
