import { CONFIG } from '@/config'

/**
 * Log levels in order of severity
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Configuration for the logger
 * @property {boolean} enabled - Whether logging is enabled
 * @property {LogLevel} minLevel - Minimum level to log
 * @property {boolean} showTimestamp - Whether to include timestamps
 * @property {boolean} showLevel - Whether to include the log level
 */
type LoggerConfig = {
	readonly enabled: boolean
	readonly minLevel: LogLevel
	readonly showTimestamp: boolean
	readonly showLevel: boolean
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
	enabled: CONFIG.DEBUG_MODE,
	minLevel: 'info',
	showTimestamp: true,
	showLevel: true
}

/**
 * Numeric values for log levels to determine severity
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
}

/**
 * ANSI color codes for different log levels
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
	debug: '\x1b[36m', // Cyan
	info: '\x1b[32m', // Green
	warn: '\x1b[33m', // Yellow
	error: '\x1b[31m' // Red
}

const RESET_COLOR = '\x1b[0m'

/**
 * Creates a timestamp string in ISO format
 */
const createTimestamp = (): string => new Date().toISOString()

/**
 * Formats a log message with optional timestamp and level
 */
const formatLogMessage = (message: string, level: LogLevel, config: LoggerConfig): string => {
	const parts = []

	if (config.showTimestamp) {
		parts.push(`[${createTimestamp()}]`)
	}

	if (config.showLevel) {
		const colorCode = LEVEL_COLORS[level]
		parts.push(`${colorCode}[${level.toUpperCase()}]${RESET_COLOR}`)
	}

	parts.push(message)

	return parts.join(' ')
}

/**
 * Determines if a message should be logged based on its level and config
 */
const shouldLog = (level: LogLevel, config: LoggerConfig): boolean =>
	config.enabled && LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[config.minLevel]

/**
 * Creates a logger function for a specific level
 */
const createLevelLogger =
	(level: LogLevel, config: LoggerConfig) =>
	(...messages: unknown[]): void => {
		if (!shouldLog(level, config)) {
			return
		}

		const formattedMessage = messages.map((msg) => (typeof msg === 'object' ? JSON.stringify(msg, null, 2) : String(msg))).join(' ')

		// eslint-disable-next-line no-console
		console[level === 'debug' ? 'log' : level](formatLogMessage(formattedMessage, level, config))
	}

/**
 * Creates a logger with the specified configuration
 */
const createLogger = (customConfig: Partial<LoggerConfig> = {}) => {
	const config = { ...DEFAULT_CONFIG, ...customConfig }

	return {
		debug: createLevelLogger('debug', config),
		info: createLevelLogger('info', config),
		warn: createLevelLogger('warn', config),
		error: createLevelLogger('error', config),

		/**
		 * Creates a new logger with updated configuration
		 */
		withConfig: (newConfig: Partial<LoggerConfig>) => createLogger({ ...config, ...newConfig })
	}
}

/**
 * The default logger instance
 */
export const logger = createLogger()
