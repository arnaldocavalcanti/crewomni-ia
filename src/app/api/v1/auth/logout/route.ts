import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse, clearRefreshTokenCookie } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    const refreshToken = request.cookies.get('refreshToken')?.value ?? ''

    await di.logoutUser.execute({ refreshToken, userId: session.userId })

    const response = new Response(null, { status: 204 })
    response.headers.set('Set-Cookie', clearRefreshTokenCookie())

    return response
  } catch (error) {
    return errorResponse(error)
  }
}
