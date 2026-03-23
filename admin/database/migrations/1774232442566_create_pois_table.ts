import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pois'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.text('description').nullable()
      table.string('category').notNullable().defaultTo('general')
      table.float('lat', 10, 7).notNullable()
      table.float('lng', 10, 7).notNullable()
      table.string('color').notNullable().defaultTo('#e74c3c')
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
