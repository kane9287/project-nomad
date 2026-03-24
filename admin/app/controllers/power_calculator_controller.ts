import type { HttpContext } from '@adonisjs/core/http'

export default class PowerCalculatorController {
  async index({ inertia }: HttpContext) {
    return inertia.render('power-calculator')
  }
}
