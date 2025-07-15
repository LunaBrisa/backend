import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'moves'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('gameId').unsigned().notNullable()
      table.foreign('gameId').references('id').inTable('game').onDelete('CASCADE')

      table.integer('playerId').unsigned().notNullable()
      table.foreign('playerId').references('id').inTable('users').onDelete('CASCADE')

      table.integer('x').unsigned().notNullable()
      table.integer('y').unsigned().notNullable()
      table.string('result', 4).notNullable()

      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
