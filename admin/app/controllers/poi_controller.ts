import type { HttpContext } from '@adonisjs/core/http'
import Poi from '#models/poi'
import { createPoiSchema, updatePoiSchema } from '#validators/poi'

export default class PoiController {
  async index({ response }: HttpContext) {
    const pois = await Poi.all()
    return response.ok(pois)
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createPoiSchema)
    const poi = await Poi.create(payload)
    return response.created(poi)
  }

  async update({ params, request, response }: HttpContext) {
    const poi = await Poi.findOrFail(params.id)
    const payload = await request.validateUsing(updatePoiSchema)
    poi.merge(payload)
    await poi.save()
    return response.ok(poi)
  }

  async destroy({ params, response }: HttpContext) {
    const poi = await Poi.findOrFail(params.id)
    await poi.delete()
    return response.ok({ message: 'POI deleted successfully' })
  }
}
