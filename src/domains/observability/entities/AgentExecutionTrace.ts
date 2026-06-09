import type { Channel } from '@/domains/channel/entities/Channel'

export type TraceStatus = 'STARTED' | 'COMPLETED' | 'FAILED'

export type AgentExecutionTrace = {
  id: string
  tenantId: string
  conversationId: string
  inboundEventId?: string
  agentId: string
  crewId?: string
  channel: Channel
  promptVersionId?: string
  model?: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
  chunksUsed: string[]
  memoryBlocksUsed: string[]
  queueWaitMs?: number
  llmDurationMs?: number
  durationMs: number
  status: TraceStatus
  error?: string
  createdAt: Date
  updatedAt: Date
}

export const LLM_PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  'gpt-4o':       { inputPerM: 5.0,  outputPerM: 15.0  },
  'gpt-4o-mini':  { inputPerM: 0.15, outputPerM: 0.6   },
  'gpt-4-turbo':  { inputPerM: 10.0, outputPerM: 30.0  },
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = LLM_PRICING[model] ?? { inputPerM: 5.0, outputPerM: 15.0 }
  return (inputTokens * pricing.inputPerM + outputTokens * pricing.outputPerM) / 1_000_000
}
