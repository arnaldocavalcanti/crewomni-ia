import { NextRequest } from 'next/server'
import { getSession } from '@/shared/guards/withSession'
import { errorResponse } from '@/shared/utils/apiResponse'
import { di } from '@/infrastructure/di'
import { AppError } from '@/shared/errors/AppError'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [session, resolvedParams] = await Promise.all([
      getSession(request),
      params,
    ])

    if (!session.tenantId) {
      throw new AppError('UNAUTHORIZED', 'Apenas usuários vinculados a um tenant podem visualizar métricas de equipe.')
    }

    const output = await di.getCrewMetrics.execute({
      tenantId: session.tenantId,
      crewId: resolvedParams.id,
    })

    return Response.json(output)
  } catch (error) {
    return errorResponse(error)
  }
}
