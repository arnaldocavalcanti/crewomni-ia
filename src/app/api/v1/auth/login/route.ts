import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse, refreshTokenCookie } from '@/shared/utils/apiResponse'

const schema = z.object({
  email: z.string().email({ message: 'E-mail inválido' }),
  password: z.string().min(8, { message: 'Senha deve ter no mínimo 8 caracteres' }),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const result = await di.authenticateUser.execute(parsed.data)

    const response = Response.json(
      { accessToken: result.accessToken, user: result.user },
      { status: 200 },
    )

    response.headers.set('Set-Cookie', refreshTokenCookie(result.refreshToken))

    return response
  } catch (error) {
    return errorResponse(error)
  }
}
