import mysql from 'mysql2/promise'
import { CONFIG } from '@/config'

export const mysqlPool = mysql.createPool({
	host: CONFIG.MYSQL_HOST,
	port: CONFIG.MYSQL_PORT,
	user: CONFIG.MYSQL_USER,
	password: CONFIG.MYSQL_PASSWORD,
	database: CONFIG.MYSQL_DATABASE,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
})
