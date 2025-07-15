import type { HttpContext } from '@adonisjs/core/http'
import Game from '#models/game'
import Board from '#models/board'
import User from '#models/user'

export default class GamesController {
  /**
   * Mostrar juegos en espera
   */
  async index({ auth }: HttpContext) {
    const games = await Game.query()
      .where('status', 'waiting')
      .whereNot('player_1', auth.user!.id)
      .preload('player1')

    return {
      games,
      auth: { user: auth.user },
    }
  }

  /**
   * Crear un nuevo juego
   */
  async create({ auth, response }: HttpContext) {
    const game = await Game.create({
      player_1: auth.user!.id,
      status: 'waiting',
      player_1_inactive_misses: 0, // Inicializar contador de fallos por inactividad
      player_2_inactive_misses: 0, // Inicializar contador de fallos por inactividad
    })

    await this.generateBoard(game, auth.user!)

    await game.load('player1')

    console.log('Juego creado', game.id)

    return response.json({
      game: {
        id: game.id,
        player_1: game.player_1,
        player_2: game.player_2,
        status: game.status,
        player_1_inactive_misses: game.player_1_inactive_misses,
        player_2_inactive_misses: game.player_2_inactive_misses,
        created_at: game.created_at,
        player1: game.player1,
      },
    })
  }

  /**
   * Unirse a un juego existente
   */
  async join({ params, auth, response }: HttpContext) {
    const game = await Game.findOrFail(params.id)

    if (game.status !== 'waiting') {
      return response.badRequest({
        error: 'El juego ya ha comenzado o ha finalizado.',
      })
    }

    await game
      .merge({
        player_2: auth.user!.id,
        status: 'active',
        player_2_inactive_misses: 0, // Asegurarse de inicializar el contador para player_2
      })
      .save()

    await this.generateBoard(game, auth.user!)

    await game.load('player1')
    await game.load('player2')
    await game.load('boards')
    await game.load('moves')

    console.log('Usuario unido al juego', game.id, 'como player_2:', auth.user!.id)

    return response.json({
      game: {
        id: game.id,
        player_1: game.player_1,
        player_2: game.player_2,
        status: game.status,
        player_1_inactive_misses: game.player_1_inactive_misses,
        player_2_inactive_misses: game.player_2_inactive_misses,
        player1: game.player1,
        player2: game.player2,
        boards: game.boards,
        moves: game.moves,
      },
    })
  }

  /**
   * Generar tablero para un jugador
   */
  private async generateBoard(game: Game, user: User) {
    // Crear grilla 8x8 llena de ceros
    const grid = Array(8)
      .fill(null)
      .map(() => Array(8).fill(0))
    const positions = new Set<string>()

    // Colocar 15 barcos aleatoriamente
    while (positions.size < 15) {
      const x = Math.floor(Math.random() * 8)
      const y = Math.floor(Math.random() * 8)
      const key = `${x}-${y}`

      if (!positions.has(key)) {
        positions.add(key)
        grid[x][y] = 1
      }
    }

    await Board.create({
      gameId: game.id,
      playerId: user.id,
      grid,
    })
  }

  /**
   * Mostrar el juego
   */
  async show({ params, auth }: HttpContext) {
    const game = await Game.query()
      .where('id', params.id)
      .preload('boards')
      .preload('moves')
      .preload('player1')
      .preload('player2')
      .firstOrFail()

    return {
      game: {
        id: game.id,
        player_1: game.player_1,
        player_2: game.player_2,
        status: game.status,
        winner: game.winner,
        player_1_inactive_misses: game.player_1_inactive_misses,
        player_2_inactive_misses: game.player_2_inactive_misses,
        player1: game.player1,
        player2: game.player2,
        boards: game.boards,
        moves: game.moves,
      },
      auth: { user: auth.user },
    }
  }

  /**
   * Mostrar estadísticas del jugador
   */
  async stats({ auth }: HttpContext) {
    const games = await Game.query()
      .where('status', 'finished')
      .where((query) => {
        query.where('player_1', auth.user!.id).orWhere('player_2', auth.user!.id)
      })
      .preload('moves', (movesQuery) => {
        movesQuery.preload('player')
      })
      .preload('player1')
      .preload('player2')
      .preload('boards')

    return {
      games,
      auth: { user: auth.user },
    }
  }

  async cancel({ params, auth, response }: HttpContext) {
    const game = await Game.findOrFail(params.id)
    if (game.player_1 !== auth.user!.id || game.status !== 'waiting') {
      return response.badRequest({ error: 'No puedes cancelar este juego' })
    }
    await game.merge({ status: 'cancelled' }).save()
    return { message: 'Juego cancelado', game }
  }

  async abandon({ params, auth, response }: HttpContext) {
    const game = await Game.findOrFail(params.id)
    if (game.status !== 'active') {
      return response.badRequest({ error: 'El juego no está activo' })
    }
    const winner = game.player_1 === auth.user!.id ? game.player_2 : game.player_1
    await game.merge({ status: 'finished', winner }).save()
    return { message: 'Juego abandonado', game }
  }
}
