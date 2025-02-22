import { z } from 'zod'
import 'zod-openapi/extend'

const timeEntrySchema = z.object({
	entity: z.string(),
	type: z.enum(['file', 'folder']),
	category: z.enum(['coding', 'reading', 'debugging']),
	start_time: z.number(),
	end_time: z.number(),
	project: z.string(),
	branch: z.string(),
	language: z.string(),
	dependencies: z.string(),
	machine_name_id: z.string(),
	line_additions: z.number(),
	line_deletions: z.number(),
	lines: z.number(),
	is_write: z.boolean()
})

export const syncDataSchema = z
	.object({
		data: z.array(timeEntrySchema),
		start: z.string().datetime(),
		end: z.string().datetime(),
		timezone: z.string()
	})
	.openapi({ ref: 'SyncData' })

export const syncResponseSchema = z
	.object({
		success: z.boolean(),
		message: z.string()
	})
	.openapi({ ref: 'SyncResponse' })
