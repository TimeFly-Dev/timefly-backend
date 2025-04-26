/**
 * Types for server configuration
 */
export interface ServerConfig {
	readonly NODE_ENV: 'development' | 'production' | 'test'
	readonly PORT: number
	readonly BASE_URL: string
	readonly FRONTEND_URL: string
	readonly DEBUG_MODE: boolean
}

/**
 * Types for authentication configuration
 */
export interface AuthConfig {
	readonly JWT_ACCESS_SECRET: string
	readonly JWT_REFRESH_SECRET: string
	readonly ACCESS_TOKEN_EXPIRES_IN: string
	readonly REFRESH_TOKEN_EXPIRES_IN: string
}

/**
 * Types for OAuth provider configuration
 */
export interface OAuthConfig {
	readonly GOOGLE_CLIENT_ID: string
	readonly GOOGLE_CLIENT_SECRET: string
}

/**
 * Types for MySQL database configuration
 */
export interface MySQLConfig {
	readonly MYSQL_HOST: string
	readonly MYSQL_PORT: number
	readonly MYSQL_USER: string
	readonly MYSQL_PASSWORD: string
	readonly MYSQL_DATABASE: string
}

/**
 * Types for ClickHouse database configuration
 */
export interface ClickHouseConfig {
	readonly CLICKHOUSE_HOST: string
	readonly CLICKHOUSE_PORT: number
	readonly CLICKHOUSE_USER: string
	readonly CLICKHOUSE_PASSWORD: string
}

/**
 * Types for email configuration
 */
export interface EmailConfig {
	readonly RESEND_API_KEY: string
	readonly EMAIL_FROM: string
}

/**
 * Types for logging configuration
 */
export interface LoggingConfig {
	readonly AUTH_LOG_BATCH_SIZE: number
	readonly AUTH_LOG_PROCESS_INTERVAL: number
}

/**
 * Combined application configuration
 */
export interface AppConfig extends ServerConfig, AuthConfig, OAuthConfig, MySQLConfig, ClickHouseConfig, EmailConfig, LoggingConfig {}

/**
 * Environment variable types
 */
export type EnvVarType = 'string' | 'number' | 'boolean'

/**
 * Environment variable definition
 */
export interface EnvVarDefinition {
	readonly type: EnvVarType
	readonly required: boolean
	readonly default?: string | number | boolean
}

/**
 * Environment variable definitions map
 */
export type EnvVarDefinitions = {
	readonly [K in keyof AppConfig]?: EnvVarDefinition
} & {
	readonly [key: string]: EnvVarDefinition
}
