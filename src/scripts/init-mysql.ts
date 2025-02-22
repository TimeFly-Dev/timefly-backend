import { mysqlPool } from '../db/mysql'

async function initMysql() {
	try {
		const connection = await mysqlPool.getConnection()

		await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        google_id VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        full_name VARCHAR(255),
        avatar_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

		await connection.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INT PRIMARY KEY,
        theme VARCHAR(20) DEFAULT 'light',
        notification_preferences JSON,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

		console.log('MySQL tables created successfully')
		connection.release()
	} catch (error) {
		console.error('Error creating MySQL tables:', error)
	} finally {
		await mysqlPool.end()
	}
}

initMysql()
