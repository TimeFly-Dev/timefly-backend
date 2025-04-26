import type { AppConfig, EnvVarDefinitions } from './types/config'

/**
 * Environment variable definitions with types, requirements, and defaults
 */
const ENV_VARS: EnvVarDefinitions = {
	// Server configuration
	NODE_ENV: { type: 'string', required: false, default: 'development' },
	PORT: { type: 'number', required: true },
	FRONTEND_URL: { type: 'string', required: false, default: 'http://localhost:3000' },
	DEBUG_MODE: { type: 'boolean', required: false, default: false },

	// Authentication configuration
	JWT_ACCESS_SECRET: { type: 'string', required: true },
	JWT_REFRESH_SECRET: { type: 'string', required: true },
	ACCESS_TOKEN_EXPIRES_IN: { type: 'string', required: false, default: '15m' },
	REFRESH_TOKEN_EXPIRES_IN: { type: 'string', required: false, default: '7d' },

	// OAuth configuration
	GOOGLE_CLIENT_ID: { type: 'string', required: true },
	GOOGLE_CLIENT_SECRET: { type: 'string', required: true },

	// MySQL configuration
	MYSQL_HOST: { type: 'string', required: true },
	MYSQL_PORT: { type: 'number', required: true },
	MYSQL_USER: { type: 'string', required: true },
	MYSQL_PASSWORD: { type: 'string', required: true },
	MYSQL_DATABASE: { type: 'string', required: true },

	// ClickHouse configuration
	CLICKHOUSE_HOST: { type: 'string', required: true },
	CLICKHOUSE_PORT: { type: 'number', required: true },
	CLICKHOUSE_USER: { type: 'string', required: true },
	CLICKHOUSE_PASSWORD: { type: 'string', required: true },

	// Email configuration
	RESEND_API_KEY: { type: 'string', required: true },
	EMAIL_FROM: { type: 'string', required: true },

	// Logging configuration
	AUTH_LOG_BATCH_SIZE: { type: 'number', required: false, default: 100 },
	AUTH_LOG_PROCESS_INTERVAL: { type: 'number', required: false, default: 5000 }
}

/**
 * Parse an environment variable based on its type definition
 * @param name - Environment variable name
 * @param definition - Environment variable definition
 * @returns Parsed value
 */
const parseEnvVar = (name: string, definition: EnvVarDefinitions[string]): string | number | boolean => {
	const value = process.env[name]

	// Check if required and missing
	if (definition.required && value === undefined) {
		throw new Error(`Missing required environment variable: ${name}`)
	}

	// Use default if value is missing
	if (value === undefined && definition.default !== undefined) {
		return definition.default
	}

	// Parse value based on type
	switch (definition.type) {
		case 'number': {
			const num = Number(value)
			if (Number.isNaN(num)) {
				throw new Error(`Environment variable ${name} must be a number`)
			}
			return num
		}
		case 'boolean':
			return value === 'true'
		case 'string':
			return value || ''
		default:
			return value || ''
	}
}

/**
 * Verify that all required properties for AppConfig are present
 * @param config - Configuration object to verify
 */
const verifyConfigProperties = (config: Record<string, unknown>): void => {
	// Get all keys from AppConfig type using a dummy object
	const requiredKeys: Array<keyof AppConfig> = [
		'NODE_ENV',
		'PORT',
		'BASE_URL',
		'FRONTEND_URL',
		'DEBUG_MODE',
		'JWT_ACCESS_SECRET',
		'JWT_REFRESH_SECRET',
		'ACCESS_TOKEN_EXPIRES_IN',
		'REFRESH_TOKEN_EXPIRES_IN',
		'GOOGLE_CLIENT_ID',
		'GOOGLE_CLIENT_SECRET',
		'MYSQL_HOST',
		'MYSQL_PORT',
		'MYSQL_USER',
		'MYSQL_PASSWORD',
		'MYSQL_DATABASE',
		'CLICKHOUSE_HOST',
		'CLICKHOUSE_PORT',
		'CLICKHOUSE_USER',
		'CLICKHOUSE_PASSWORD',
		'RESEND_API_KEY',
		'EMAIL_FROM',
		'AUTH_LOG_BATCH_SIZE',
		'AUTH_LOG_PROCESS_INTERVAL'
	]

	// Check that all required keys are present
	const missingKeys = requiredKeys.filter((key) => !(key in config))
	if (missingKeys.length > 0) {
		throw new Error(`Missing required configuration properties: ${missingKeys.join(', ')}`)
	}
}

/**
 * Load and validate all environment variables
 * @returns Validated configuration object
 */
const loadConfig = (): AppConfig => {
	// Parse all environment variables using a functional approach without spread
	const parsedEntries = Object.entries(ENV_VARS).map(([name, definition]) => [name, parseEnvVar(name, definition)])

	const parsedConfig = Object.fromEntries(parsedEntries)

	// Calculate BASE_URL from PORT if not provided
	const port = parsedConfig.PORT as number
	const baseUrl = process.env.BASE_URL || `http://localhost:${port}`

	// Add BASE_URL to config without using spread
	const finalConfig = Object.assign({}, parsedConfig, { BASE_URL: baseUrl })

	// Verify that all required properties are present
	verifyConfigProperties(finalConfig)

	// Now we can safely assert the type
	return finalConfig as AppConfig
}

/**
 * Application configuration
 */
export const CONFIG = loadConfig()
