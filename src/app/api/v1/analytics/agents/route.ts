import { type NextRequest, NextResponse } from 'next/server'
import { di } from '@/infrastructure/di'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'
import { errorResponse } from '@/shared/utils/apiResponse'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    const tenantId = session.tenantId!
    const { searchParams } = new URL(req.url)
    const timeRange = searchParams.get('timeRange') || '7d'
    
    const daysBack = parseInt(timeRange.replace('d', ''), 10) || 7

    const result = await di.getAgentMetrics.execute({ tenantId, daysBack })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[GET /api/v1/analytics/agents]', error)
    return errorResponse(error)
  }
}
