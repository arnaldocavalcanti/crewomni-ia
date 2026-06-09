import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'
import { AppError } from '@/shared/errors/AppError'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session.tenantId) {
      throw new AppError('UNAUTHORIZED', 'Tenant não encontrado na sessão')
    }

    const result = await di.checkUsageLimit.execute({ tenantId: session.tenantId })

    return Response.json(result, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
