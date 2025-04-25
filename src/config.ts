// Ensure that NODE_ENV is set
if (!process.env.NODE_ENV) {
	console.warn('NODE_ENV not set. Defaulting to development.')
	process.env.NODE_ENV = 'development'
}

const requiredEnvVars = [
	'PORT',
	'ACCESS_TOKEN_EXPIRES_IN',
	'REFRESH_TOKEN_EXPIRES_IN',
	'JWT_ACCESS_SECRET',
	'JWT_REFRESH_SECRET',
	'GOOGLE_CLIENT_ID',
	'GOOGLE_CLIENT_SECRET',
	'CLICKHOUSE_HOST',
	'CLICKHOUSE_PORT',
	'CLICKHOUSE_USER',
	'CLICKHOUSE_PASSWORD',
	'MYSQL_HOST',
	'MYSQL_PORT',
	'MYSQL_USER',
	'MYSQL_PASSWORD',
	'MYSQL_DATABASE',
	'RESEND_API_KEY',
	'EMAIL_FROM'
]

// Validate required environment variables
for (const envVar of requiredEnvVars) {
	if (!process.env[envVar]) {
		throw new Error(`Missing required environment variable: ${envVar}`)
	}
}

export const CONFIG = {
	NODE_ENV: process.env.NODE_ENV as string,
	PORT: Number(process.env.PORT),
	JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET as string,
	JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
	ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
	REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET as string,
	GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'https://api.timefly.dev/auth/google/callback',
	GOOGLE_FRONTEND_REDIRECT_URI: process.env.GOOGLE_FRONTEND_REDIRECT_URI || 'https://timefly.dev/google/callback',
	CLICKHOUSE_HOST: process.env.CLICKHOUSE_HOST as string,
	CLICKHOUSE_PORT: Number(process.env.CLICKHOUSE_PORT),
	CLICKHOUSE_USER: process.env.CLICKHOUSE_USER as string,
	CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD as string,
	MYSQL_HOST: process.env.MYSQL_HOST as string,
	MYSQL_PORT: Number(process.env.MYSQL_PORT),
	MYSQL_USER: process.env.MYSQL_USER as string,
	MYSQL_PASSWORD: process.env.MYSQL_PASSWORD as string,
	MYSQL_DATABASE: process.env.MYSQL_DATABASE as string,
	AUTH_LOG_BATCH_SIZE: Number(process.env.AUTH_LOG_BATCH_SIZE || '100'),
	AUTH_LOG_PROCESS_INTERVAL: Number(process.env.AUTH_LOG_PROCESS_INTERVAL || '5000'),
	RESEND_API_KEY: process.env.RESEND_API_KEY as string,
	EMAIL_FROM: process.env.EMAIL_FROM as string,
	BASE_URL: process.env.BASE_URL || 'http://localhost:3000'
}

// Type assertion to ensure all config values are defined
const assertConfig: Record<keyof typeof CONFIG, string | number> = CONFIG

// Validate that all config values are defined and of the correct type
Object.entries(assertConfig).forEach(([key, value]) => {
	if (value === undefined) {
		throw new Error(`Configuration value for ${key} is undefined`)
	}
	if (['RESEND_API_KEY', 'EMAIL_FROM'].includes(key)) {
		if (typeof value !== 'string') {
			throw new Error(`Configuration value for ${key} is not a valid string`)
		}
	}
	if (['PORT', 'CLICKHOUSE_PORT', 'MYSQL_PORT', 'AUTH_LOG_BATCH_SIZE', 'AUTH_LOG_PROCESS_INTERVAL'].includes(key)) {
		if (typeof value !== 'number' || Number.isNaN(value)) {
			throw new Error(`Configuration value for ${key} is not a valid number`)
		}
	} else if (typeof value !== 'string') {
		throw new Error(`Configuration value for ${key} is not a string`)
	}
})
