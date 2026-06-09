import type { ITraceRepository } from '../repositories/ITraceRepository'
import { estimateCost, type AgentExecutionTrace } from '../entities/AgentExecutionTrace'
import type { Channel } from '@/domains/channel/entities/Channel'

type StartInput = {
  tenantId: string
  conversationId: string
  inboundEventId?: string
  agentId: string
  crewId?: string
  channel: Channel
  promptVersionId?: string
}

type CompleteInput = {
  model: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  chunksUsed: string[]
  memoryBlocksUsed: string[]
  queueWaitMs?: number
  llmDurationMs?: number
  error?: string
}

export class RecordExecutionTrace {
  constructor(private traceRepo: ITraceRepository) {}

  async start(input: StartInput): Promise<AgentExecutionTrace> {
    const trace: AgentExecutionTrace = {
      id: crypto.randomUUID(),
      ...input,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      chunksUsed: [],
      memoryBlocksUsed: [],
      durationMs: 0,
      status: 'STARTED',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    try { await this.traceRepo.createTrace(trace) } catch { /* best-effort */ }
    return trace
  }

  async complete(id: string, tenantId: string, input: CompleteInput): Promise<void> {
    const { model, inputTokens, outputTokens, durationMs, chunksUsed, memoryBlocksUsed, queueWaitMs, llmDurationMs, error } = input
    const totalTokens = inputTokens + outputTokens
    const estimatedCostUsd = estimateCost(model, inputTokens, outputTokens)
    try {
      await this.traceRepo.updateTrace(id, tenantId, {
        status: error ? 'FAILED' : 'COMPLETED',
        model, inputTokens, outputTokens, totalTokens, estimatedCostUsd,
        chunksUsed, memoryBlocksUsed, queueWaitMs, llmDurationMs, durationMs, error,
      })
    } catch { /* best-effort */ }
  }
}
