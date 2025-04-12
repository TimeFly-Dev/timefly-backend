import { z } from 'zod'
import 'zod-openapi/extend'

const commonFields = {
	entity: z.string(),
	type: z.enum(['file', 'app', 'domain']),
	state: z.enum(['coding', 'debugging']),
	project: z.string().optional(),
	branch: z.string().optional(),
	language: z.string().optional(),
	dependencies: z.string().optional(),
	machine_name_id: z.string(),
	line_additions: z.number().optional(),
	line_deletions: z.number().optional(),
	lines: z.number(),
	is_write: z.boolean()
}

const pulseSchema = z.object({
	...commonFields,
	time: z.number(),
	project_root_count: z.number(),
	lineno: z.number().optional(),
	cursorpos: z.number().optional(),
	// Replace z.undefined() with z.null() and add openapi type annotation
	start_time: z.null().optional().openapi({ type: 'null' }),
	end_time: z.null().optional().openapi({ type: 'null' })
})

const aggregatedPulseSchema = z.object({
	...commonFields,
	start_time: z.number(),
	end_time: z.number(),
	line_additions: z.number(),
	line_deletions: z.number(),
	// Replace z.undefined() with z.null() and add openapi type annotation
	time: z.null().optional().openapi({ type: 'null' }),
	project_root_count: z.null().optional().openapi({ type: 'null' }),
	lineno: z.null().optional().openapi({ type: 'null' }),
	cursorpos: z.null().optional().openapi({ type: 'null' })
})

export const syncDataSchema = z
	.object({
		data: z.array(z.union([pulseSchema, aggregatedPulseSchema])),
		start: z.string().datetime(),
		end: z.string().datetime(),
		timezone: z.string()
	})
	.openapi({ ref: 'SyncData' })

export const syncResponseSchema = z
	.object({
		success: z.boolean(),
		message: z.string(),
		syncedCount: z.number().optional(),
		errors: z.array(z.string()).optional()
	})
	.openapi({ ref: 'SyncResponse' })
