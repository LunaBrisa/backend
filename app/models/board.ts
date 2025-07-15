import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Game from './game.js'
import User from './user.js'

export default class Board extends BaseModel {
  static timestamps = false

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'gameId' })
  declare gameId: number

  @column({ columnName: 'playerId' })
  declare playerId: number

  @column({
    columnName: 'grid',
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value),
  })
  declare grid: any[]

  // Relaciones
  @belongsTo(() => Game)
  declare game: BelongsTo<typeof Game>

  @belongsTo(() => User, {
    foreignKey: 'playerId',
  })
  declare player: BelongsTo<typeof User>
}
