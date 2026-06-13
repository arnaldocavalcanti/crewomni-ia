import { NextRequest, NextResponse } from 'next/server'
import { getValidatedSession } from '@/infrastructure/guards/withValidatedSession'
import { di } from '@/infrastructure/di'
import { AppError } from '@/shared/errors/AppError'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getValidatedSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const contactPhone: string | undefined = body.contactPhone ?? undefined

  try {
    const result = await di.acceptHumanHandoff.execute({
      tenantId: session.tenantId!,
      conversationId: id,
      contactPhone,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
