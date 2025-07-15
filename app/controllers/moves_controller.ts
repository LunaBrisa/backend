import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Game from '#models/game'
import Board from '#models/board'
import Move from '#models/move'
import logger from '@adonisjs/core/services/logger'

export default class MovesController {
async store({ request, params, auth, response }: HttpContext) {
  try {
    const game = await Game.findOrFail(params.gameId)

    // 🚫 Si el juego ya terminó, no permitir movimientos
    if (game.status === 'finished') {
      return response.badRequest({
        error: 'El juego ya ha finalizado.',
        game: await this.getGameWithRelations(game),
      })
    }

    // Verificar si han pasado 30 segundos desde el último movimiento
    await this.checkInactiveMove(game, auth.user!.id)

    logger.info('Intento de movimiento', {
      user_id: auth.user!.id,
      game_id: game.id,
      game_status: game.status,
      is_player_turn: await this.isPlayerTurn(game, auth.user!.id),
      request_data: request.all(),
    })

    const moveValidator = vine.compile(
      vine.object({
        x: vine.number().min(0).max(7),
        y: vine.number().min(0).max(7),
      })
    )

    const { x, y } = await request.validateUsing(moveValidator)

    const existingMove = await Move.query()
      .where('gameId', game.id)
      .where('playerId', auth.user!.id)
      .where('x', x)
      .where('y', y)
      .first()

    if (existingMove) {
      logger.warn('Movimiento duplicado', { x, y })
      return response.badRequest({
        error: 'Ya has realizado un movimiento en esa posición.',
        game: await this.getGameWithRelations(game),
      })
    }

    if (game.status !== 'active' || !(await this.isPlayerTurn(game, auth.user!.id))) {
      logger.error('Movimiento inválido', {
        game_status: game.status,
        is_player_turn: await this.isPlayerTurn(game, auth.user!.id),
      })
      return response.badRequest({
        error: 'Estado del juego inválido o no es tu turno.',
        game: await this.getGameWithRelations(game),
      })
    }

    const opponentId = game.player_1 === auth.user!.id ? game.player_2 : game.player_1

    const opponentBoard = await Board.query()
      .where('gameId', game.id)
      .where('playerId', opponentId)
      .first()

    if (!opponentBoard) {
      logger.error('Tablero del oponente no encontrado', {
        game_id: game.id,
        opponent_id: opponentId,
      })
      return response.badRequest({
        error: 'Tablero del oponente no encontrado.',
        game: await this.getGameWithRelations(game),
      })
    }

    const grid = opponentBoard.grid
    logger.debug('Grid del oponente', { grid, x, y, cellValue: grid[y][x] })

    if (!grid[y] || grid[y][x] === undefined) {
      logger.error('Índice de grid inválido', { y, x })
      return response.badRequest({
        error: 'Posición inválida en el tablero.',
        game: await this.getGameWithRelations(game),
      })
    }

    const result = grid[y][x] ? 'hit' : 'miss'
    logger.info('Resultado del movimiento', { x, y, result, cellValue: grid[y][x] })

    const move = await Move.create({
      gameId: game.id,
      playerId: auth.user!.id,
      x,
      y,
      result,
    })

    logger.info('Movimiento registrado', {
      move_id: move.id,
      result,
      x,
      y,
    })

    const hitsCount = await Move.query()
      .where('gameId', game.id)
      .where('playerId', auth.user!.id)
      .where('result', 'hit')
      .count('* as total')

    const totalHits = hitsCount[0].$extras.total

    // ✅ Solo finalizar si aún no hay ganador ni está terminado
    if (parseInt(totalHits) >= 15 && game.status === 'active' && !game.winner) {
      await game
        .merge({
          status: 'finished',
          winner: auth.user!.id,
        })
        .save()

      logger.info('Juego finalizado', { winner: auth.user!.id })
    }

    return {
      message: 'Movimiento registrado correctamente.',
      result,
      game: await this.getGameWithRelations(await game.refresh()),
    }
  } catch (error) {
    logger.error('Error al registrar movimiento', {
      error: error.message,
      stack: error.stack,
      game_id: params.gameId,
      user_id: auth.user!.id,
      request_data: request.all(),
    })
    return response.status(500).json({
      error: 'Error interno al registrar el movimiento',
      details: error.message,
    })
  }
}

  async poll({ request, params, auth, response }: HttpContext) {
    try {
      const game = await Game.findOrFail(params.gameId)
      const lastMoveId = Number.parseInt(request.qs().last_move_id || '0')

      // Verificar si hay un movimiento automático por inactividad
      await this.checkInactiveMove(game, auth.user!.id)

      const latestMove = await Move.query()
        .where('gameId', game.id)
        .where('id', '>', lastMoveId)
        .orderBy('id', 'desc')
        .first()

      if (latestMove) {
        logger.info('Nuevo movimiento detectado en polling', { move_id: latestMove.id })
        return {
          game: await this.getGameWithRelations(await game.refresh()),
          last_move_id: latestMove.id,
          auth: { user: auth.user },
        }
      }

      return {
        game: await this.getGameWithRelations(game),
        last_move_id: lastMoveId,
        auth: { user: auth.user },
        status: 'no_changes',
      }
    } catch (error) {
      logger.error('Error en polling', {
        error: error.message,
        stack: error.stack,
        game_id: params.gameId,
        user_id: auth.user!.id,
      })
      return response.status(500).json({
        error: 'Error interno al actualizar el estado del juego',
        details: error.message,
      })
    }
  }

  private async checkInactiveMove(game: Game, userId: number) {
    if (game.status !== 'active') return

    const lastMove = await Move.query().where('gameId', game.id).orderBy('id', 'desc').first()

    const isPlayerTurn = !lastMove ? game.player_1 === userId : lastMove.playerId !== userId

    if (!isPlayerTurn) return

    const now = DateTime.now()
    const gameCreatedAt = game.created_at ? DateTime.fromJSDate(game.created_at.toJSDate()) : now
    const lastMoveTime = lastMove
      ? DateTime.fromJSDate(lastMove.createdAt.toJSDate())
      : gameCreatedAt
    const timeSinceLastMove = now.diff(lastMoveTime, 'seconds').seconds

    if (timeSinceLastMove >= 30) {
      logger.info('Tiempo de inactividad excedido, registrando movimiento automático', {
        game_id: game.id,
        user_id: userId,
        time_since_last_move: timeSinceLastMove,
      })

      // Encontrar una posición no jugada para el movimiento automático
      const opponentId = game.player_1 === userId ? game.player_2 : game.player_1
      const opponentBoard = await Board.query()
        .where('gameId', game.id)
        .where('playerId', opponentId)
        .first()

      if (!opponentBoard) {
        logger.error('Tablero del oponente no encontrado para movimiento automático', {
          game_id: game.id,
          opponent_id: opponentId,
        })
        return
      }

      const moves = await Move.query().where('gameId', game.id).where('playerId', userId)

      const playedPositions = new Set(moves.map((m) => `${m.x}-${m.y}`))
      let x: number
      let y: number
      do {
        x = Math.floor(Math.random() * 8)
        y = Math.floor(Math.random() * 8)
      } while (playedPositions.has(`${x}-${y}`))

      const move = await Move.create({
        gameId: game.id,
        playerId: userId,
        x,
        y,
        result: 'miss',
      })

      logger.info('Movimiento automático registrado', {
        move_id: move.id,
        x,
        y,
        result: 'miss',
      })

      // Incrementar el contador de fallos por inactividad
      const inactiveMissesField =
        userId === game.player_1 ? 'player_1_inactive_misses' : 'player_2_inactive_misses'
      const inactiveMisses =
        (userId === game.player_1 ? game.player_1_inactive_misses : game.player_2_inactive_misses) +
        1

      await game.merge({ [inactiveMissesField]: inactiveMisses }).save()

      // Verificar si el jugador ha alcanzado 3 fallos por inactividad
      if (inactiveMisses >= 3) {
        const winner = userId === game.player_1 ? game.player_2 : game.player_1
        await game
          .merge({
            status: 'finished',
            winner,
          })
          .save()
        logger.info('Juego finalizado por inactividad', { winner })
      }
    }
  }

  private async isPlayerTurn(game: Game, userId: number): Promise<boolean> {
    const lastMove = await Move.query().where('gameId', game.id).orderBy('id', 'desc').first()

    logger.info('Verificando turno', {
      game_id: game.id,
      user_id: userId,
      last_move_player_id: lastMove ? lastMove.playerId : null,
      player_1: game.player_1,
      player_2: game.player_2,
      is_first_move: !lastMove,
      is_player_turn: !lastMove ? game.player_1 === userId : lastMove.playerId !== userId,
    })

    return !lastMove ? game.player_1 === userId : lastMove.playerId !== userId
  }

  private async getGameWithRelations(game: Game) {
    return await Game.query()
      .where('id', game.id)
      .preload('boards')
      .preload('moves')
      .preload('player1')
      .preload('player2')
      .firstOrFail()
  }
}
