import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Board from './board.js'
import Move from './move.js'
import { DateTime } from 'luxon'

export default class Game extends BaseModel {
  static table = 'game'
  static timestamps = true

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare player_1: number

  @column()
  declare player_2: number

  @column()
  declare status: string

  @column()
  declare winner: number | null

  @column()
  declare player_1_inactive_misses: number

  @column()
  declare player_2_inactive_misses: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => User, {
    foreignKey: 'player_1',
  })
  declare player1: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'player_2',
  })
  declare player2: BelongsTo<typeof User>

  @hasMany(() => Board)
  declare boards: HasMany<typeof Board>

  @hasMany(() => Move)
  declare moves: HasMany<typeof Move>
}
