import vine from '@vinejs/vine'

export const createPoiSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(200),
    description: vine.string().trim().maxLength(1000).optional(),
    category: vine.string().trim().minLength(1).maxLength(50),
    lat: vine.number().min(-90).max(90),
    lng: vine.number().min(-180).max(180),
    color: vine.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  })
)

export const updatePoiSchema = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(200).optional(),
    description: vine.string().trim().maxLength(1000).optional(),
    category: vine.string().trim().minLength(1).maxLength(50).optional(),
    lat: vine.number().min(-90).max(90).optional(),
    lng: vine.number().min(-180).max(180).optional(),
    color: vine.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
)
