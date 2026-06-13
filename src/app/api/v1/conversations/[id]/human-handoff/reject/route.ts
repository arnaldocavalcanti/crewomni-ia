import { NextRequest, NextResponse } from 'next/server'
import { getValidatedSession } from '@/infrastructure/guards/withValidatedSession'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getValidatedSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rejection: customer chose to continue with AI; no action needed server-side
  void params // params resolved but not needed
  return NextResponse.json({ success: true })
}
