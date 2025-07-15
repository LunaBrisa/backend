import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'boards'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('gameId').unsigned().notNullable()
      table.foreign('gameId').references('id').inTable('game').onDelete('CASCADE')

      table.integer('playerId').unsigned().notNullable()
      table.foreign('playerId').references('id').inTable('users').onDelete('CASCADE')

      table.text('grid').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
