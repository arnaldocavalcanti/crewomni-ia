import type { ITraceRepository } from '@/domains/observability/repositories/ITraceRepository'
import type { AgentExecutionTrace, TraceStatus } from '@/domains/observability/entities/AgentExecutionTrace'

export class InMemoryTraceRepository implements ITraceRepository {
  private store: AgentExecutionTrace[] = []

  async createTrace(trace: AgentExecutionTrace) { this.store.push({ ...trace }) }

  async updateTrace(id: string, tenantId: string, update: any) {
    const idx = this.store.findIndex(t => t.id === id && t.tenantId === tenantId)
    if (idx >= 0) this.store[idx] = { ...this.store[idx], ...update, updatedAt: new Date() }
  }

  async findByConversation(conversationId: string, tenantId: string) {
    return this.store.filter(t => t.conversationId === conversationId && t.tenantId === tenantId)
  }

  async getTenantUsageSummary(tenantId: string, from: Date, to: Date) {
    const traces = this.store.filter(t =>
      t.tenantId === tenantId && t.createdAt >= from && t.createdAt <= to && t.status === 'COMPLETED'
    )
    return {
      totalTokens: traces.reduce((s, t) => s + t.totalTokens, 0),
      totalCostUsd: traces.reduce((s, t) => s + t.estimatedCostUsd, 0),
      totalTurns: traces.length,
    }
  }
}
