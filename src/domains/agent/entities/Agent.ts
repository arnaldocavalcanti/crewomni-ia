export enum AgentType {
  SDR = 'SDR',
  HELPDESK = 'HELPDESK',
  NEGOTIATION = 'NEGOTIATION',
  ONBOARDING = 'ONBOARDING',
  SUPPORT = 'SUPPORT',
  SALES = 'SALES',
}

export enum AgentStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export type Agent = {
  id: string
  tenantId: string
  name: string
  slug: string
  type: AgentType
  description: string | null
  status: AgentStatus
  createdAt: Date
  updatedAt: Date
}

export type CreateAgentData = {
  tenantId: string
  name: string
  slug: string
  type: AgentType
  description?: string
}
