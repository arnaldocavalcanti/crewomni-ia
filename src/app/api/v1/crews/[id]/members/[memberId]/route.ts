import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const [session, { memberId }] = await Promise.all([getSession(request), params])
    await di.removeAgentFromCrew.execute({ memberId, tenantId: session.tenantId! })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
