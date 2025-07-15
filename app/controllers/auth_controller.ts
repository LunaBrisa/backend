import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'

export default class AuthController {
  async register({ request, response }: HttpContext) {
    const registerValidator = vine.compile(
      vine.object({
        fullName: vine.string().trim().minLength(2).maxLength(255),
        email: vine.string().email().normalizeEmail(),
        password: vine.string().minLength(6).maxLength(255),
      })
    )

    const data = await request.validateUsing(registerValidator)

    const existingUser = await User.findBy('email', data.email)
    if (existingUser) {
      return response.badRequest({
        error: 'Ya existe un usuario con este email',
      })
    }

    const user = await User.create({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
    })

    const token = await User.accessTokens.create(user)

    return response.json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      },
      token: {
        type: 'Bearer',
        value: token.value!.release(),
      },
    })
  }

  async login({ request, response }: HttpContext) {
    const loginValidator = vine.compile(
      vine.object({
        email: vine.string().email().normalizeEmail(),
        password: vine.string().minLength(1),
      })
    )

    const { email, password } = await request.validateUsing(loginValidator)

    try {
      // Buscar usuario por email
      const user = await User.findBy('email', email)

      if (!user) {
        return response.badRequest({
          error: 'Credenciales incorrectas',
        })
      }

      // Verificar password
      const isValidPassword = await hash.verify(user.password, password)

      if (!isValidPassword) {
        return response.badRequest({
          error: 'Credenciales incorrectas',
        })
      }

      // Crear token de acceso
      const token = await User.accessTokens.create(user)

      return response.json({
        message: 'Login exitoso',
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        },
        token: {
          type: 'Bearer',
          value: token.value!.release(),
        },
      })
    } catch (error) {
      return response.badRequest({
        error: 'Error en el proceso de autenticación',
      })
    }
  }

  async logout({ auth, response }: HttpContext) {
    try {
      const user = auth.getUserOrFail()
      const token = auth.user?.currentAccessToken

      if (token) {
        await User.accessTokens.delete(user, token.identifier)
      }

      return response.json({
        message: 'Sesión cerrada exitosamente',
      })
    } catch (error) {
      return response.badRequest({
        error: 'Error al cerrar sesión',
      })
    }
  }

  async me({ auth, response }: HttpContext) {
    try {
      const user = auth.getUserOrFail()

      return response.json({
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        },
      })
    } catch (error) {
      return response.unauthorized({
        error: 'No autenticado',
      })
    }
  }
}
