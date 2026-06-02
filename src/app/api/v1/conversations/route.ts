import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    const { searchParams } = new URL(request.url)

    const agentId = searchParams.get('agentId') ?? undefined
    const page = Number(searchParams.get('page') ?? '1')
    const limit = Number(searchParams.get('limit') ?? '20')

    const result = await di.listConversations.execute({
      tenantId: session.tenantId!,
      agentId,
      page,
      limit,
    })

    return Response.json(result, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
