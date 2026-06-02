import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])

    await di.deleteDocument.execute({
      documentId: id,
      tenantId: session.tenantId!,
      requestedByRole: session.role,
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
