import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    const { id } = await params

    await di.deleteChannelConfig.execute({
      tenantId: session.tenantId!,
      id,
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
