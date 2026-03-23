import { DateTime } from 'luxon'
import { BaseModel, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'

export default class Poi extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare category: string

  @column()
  declare lat: number

  @column()
  declare lng: number

  @column()
  declare color: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
