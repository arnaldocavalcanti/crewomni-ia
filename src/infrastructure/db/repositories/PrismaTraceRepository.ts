import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { ITraceRepository } from '@/domains/observability/repositories/ITraceRepository'
import type { AgentExecutionTrace, TraceStatus } from '@/domains/observability/entities/AgentExecutionTrace'

export class PrismaTraceRepository implements ITraceRepository {
  private get db() {
    return getPrismaClient()
  }

  async createTrace(trace: AgentExecutionTrace): Promise<void> {
    await this.db.agentExecutionTrace.create({ data: trace as any })
  }

  async updateTrace(
    id: string,
    tenantId: string,
    update: {
      status: TraceStatus
      model?: string
      inputTokens?: number
      outputTokens?: number
      totalTokens?: number
      estimatedCostUsd?: number
      chunksUsed?: string[]
      memoryBlocksUsed?: string[]
      queueWaitMs?: number
      llmDurationMs?: number
      durationMs?: number
      error?: string
    }
  ): Promise<void> {
    await this.db.agentExecutionTrace.updateMany({
      where: { id, tenantId },
      data: update as any,
    })
  }

  async findByConversation(conversationId: string, tenantId: string): Promise<AgentExecutionTrace[]> {
    const records = await this.db.agentExecutionTrace.findMany({
      where: { conversationId, tenantId },
      orderBy: { createdAt: 'asc' },
    })
    return records as unknown as AgentExecutionTrace[]
  }

  async getTenantUsageSummary(
    tenantId: string,
    from: Date,
    to: Date
  ): Promise<{ totalTokens: number; totalCostUsd: number; totalTurns: number }> {
    const stats = await this.db.agentExecutionTrace.aggregate({
      where: {
        tenantId,
        status: 'COMPLETED',
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      _sum: {
        totalTokens: true,
        estimatedCostUsd: true,
      },
      _count: {
        id: true,
      },
    })

    return {
      totalTokens: stats._sum.totalTokens ?? 0,
      totalCostUsd: stats._sum.estimatedCostUsd ?? 0,
      totalTurns: stats._count.id ?? 0,
    }
  }
}
