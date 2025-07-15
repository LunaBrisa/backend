import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'game'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('player_1_inactive_misses').unsigned().notNullable().defaultTo(0)
      table.integer('player_2_inactive_misses').unsigned().notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('player_1_inactive_misses')
      table.dropColumn('player_2_inactive_misses')
    })
  }
}
