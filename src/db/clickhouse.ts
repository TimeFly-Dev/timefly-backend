import { createClient } from '@clickhouse/client'
import { CONFIG } from '@/config'

export const clickhouseClient = createClient({
	url: `http://${CONFIG.CLICKHOUSE_HOST}:${CONFIG.CLICKHOUSE_PORT}`,
	username: CONFIG.CLICKHOUSE_USER,
	password: CONFIG.CLICKHOUSE_PASSWORD
})
