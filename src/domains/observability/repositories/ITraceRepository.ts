import type { AgentExecutionTrace, TraceStatus } from '../entities/AgentExecutionTrace'

export interface ITraceRepository {
  createTrace(trace: AgentExecutionTrace): Promise<void>
  updateTrace(
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
  ): Promise<void>
  findByConversation(conversationId: string, tenantId: string): Promise<AgentExecutionTrace[]>
  getTenantUsageSummary(
    tenantId: string,
    from: Date,
    to: Date
  ): Promise<{ totalTokens: number; totalCostUsd: number; totalTurns: number }>
}
