import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse, refreshTokenCookie } from '@/shared/utils/apiResponse'

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refreshToken')?.value

    if (!refreshToken) {
      return Response.json(
        { code: 'SESSION_EXPIRED', message: 'Sessão expirada. Faça login novamente' },
        { status: 401 },
      )
    }

    const result = await di.refreshSession.execute({ refreshToken })

    const response = Response.json(
      { accessToken: result.accessToken },
      { status: 200 },
    )

    response.headers.set('Set-Cookie', refreshTokenCookie(result.refreshToken))

    return response
  } catch (error) {
    return errorResponse(error)
  }
}
