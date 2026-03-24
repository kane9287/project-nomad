import type { HttpContext } from '@adonisjs/core/http'

export default class WaterCalculatorController {
  async index({ inertia }: HttpContext) {
    return inertia.render('water-calculator')
  }
}
