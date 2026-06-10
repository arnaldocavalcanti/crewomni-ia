// src/domains/crew/entities/TestSessionResult.ts

export type FlowPathEntry = {
  agentId: string
  agentName: string
  agentType: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
  action: 'RESPONDED' | 'TRANSFERRED' | 'WAITING'
  responseSnippet?: string
  durationMs: number
}

export type HandoffEntry = {
  fromAgentId: string
  fromAgentName: string
  toAgentId: string
  toAgentName: string
  reason?: string
}

export type TraceStep = {
  step: string
  durationMs: number
  detail?: string
}

export type TestSessionTrace = {
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  durationMs: number
  memoryBlocksUsed: string[]
  chunksUsed: string[]
  steps?: TraceStep[]
}

export type TestSessionResult = {
  conversationId: string
  reply: string
  flowPath: FlowPathEntry[]
  handoffs: HandoffEntry[]
  trace: TestSessionTrace
}
