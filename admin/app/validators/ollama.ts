import vine from '@vinejs/vine'

export const chatSchema = vine.compile(
  vine.object({
    model: vine.string().trim().minLength(1),
    messages: vine.array(
      vine.object({
        role: vine.enum(['system', 'user', 'assistant'] as const),
        content: vine.string(),
      })
    ),
    stream: vine.boolean().optional(),
    sessionId: vine.number().positive().optional(),
  })
)

export const getAvailableModelsSchema = vine.compile(
  vine.object({
    sort: vine.enum(['pulls', 'name'] as const).optional(),
    recommendedOnly: vine.boolean().optional(),
    query: vine.string().trim().optional(),
    limit: vine.number().positive().optional(),
    force: vine.boolean().optional(),
  })
)

export const customModelSchema = vine.compile(
  vine.object({
    model: vine.object({
      id: vine.string().trim().minLength(1),
      name: vine.string().trim().minLength(1),
      description: vine.string().trim().optional().transform((v) => v ?? ''),
      estimated_pulls: vine.string().trim().optional().transform((v) => v ?? 'Custom'),
      model_last_updated: vine.string().trim().optional().transform((v) => v ?? 'Just added'),
      first_seen: vine.string().trim().optional().transform((v) => v ?? new Date().toISOString()),
      tags: vine.array(
        vine.object({
          name: vine.string().trim().minLength(1),
          size: vine.string().trim().optional().transform((v) => v ?? 'Unknown'),
          context: vine.string().trim().optional().transform((v) => v ?? 'Unknown'),
          input: vine.string().trim().optional().transform((v) => v ?? 'Text'),
          cloud: vine.boolean().optional().transform((v) => v ?? false),
          thinking: vine.boolean().optional().transform((v) => v ?? false),
        })
      ).minLength(1),
    }),
  })
)
