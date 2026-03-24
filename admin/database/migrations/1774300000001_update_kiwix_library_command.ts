import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.defer(async (db) => {
      await db
        .from(this.tableName)
        .where('service_name', 'nomad_kiwix_server')
        .where('container_command', '*.zim --address=all')
        .update({ container_command: '--library /data/library.xml --address=all' })
    })
  }

  async down() {
    this.defer(async (db) => {
      await db
        .from(this.tableName)
        .where('service_name', 'nomad_kiwix_server')
        .where('container_command', '--library /data/library.xml --address=all')
        .update({ container_command: '*.zim --address=all' })
    })
  }
}
