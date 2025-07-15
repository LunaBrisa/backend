import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'game'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('player_1').unsigned().notNullable()
      table.foreign('player_1').references('id').inTable('users').onDelete('CASCADE')

      table.integer('player_2').unsigned().nullable()
      table.foreign('player_2').references('id').inTable('users').onDelete('CASCADE')

      table.string('status', 20).notNullable()

      table.integer('winner').unsigned().nullable()
      table.foreign('winner').references('id').inTable('users').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
