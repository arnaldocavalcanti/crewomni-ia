export enum PromptVersionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
}

export type AgentPromptVersion = {
  id: string
  agentId: string
  tenantId: string
  systemPrompt: string
  version: number
  status: PromptVersionStatus
  createdAt: Date
}

export type CreatePromptVersionData = {
  agentId: string
  tenantId: string
  systemPrompt: string
  version: number
  status: PromptVersionStatus
}
