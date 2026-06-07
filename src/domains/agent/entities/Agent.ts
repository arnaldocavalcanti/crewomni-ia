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
  type: AgentType // Deprecated for UI, preserved for backend compat
  category: string
  roleId: string
  operationalFunction: string
  description: string | null
  status: AgentStatus
  createdAt: Date
  updatedAt: Date

  // Contexto Organizacional & Responsável
  directorId: string | null
  mainChannel: string | null

  // Comportamento & Autonomia
  toneOfVoice: string | null
  communicationStyle: string | null
  autonomyLevel: string | null
  responsibilities: string[] // Stored as Json array in DB

  // Permissões e Ferramentas
  permissionReadKB: boolean
  permissionSendWhatsapp: boolean
  permissionSendEmail: boolean
  permissionExecuteTool: boolean
  permissionCallHuman: boolean
  permissionCreateTask: boolean
  permissionReadHistory: boolean
  permissionReadCommercial: boolean

  // System Prompt Customizado (Complementos)
  outputFormat: string | null
  expectedExamples: string | null
  specificRules: string | null
}

export type UpdateAgentData = {
  name?: string
  description?: string | null
  category?: string
  roleId?: string
  operationalFunction?: string
  status?: AgentStatus
  directorId?: string | null
  mainChannel?: string | null
  toneOfVoice?: string | null
  communicationStyle?: string | null
  autonomyLevel?: string | null
  responsibilities?: string[]
  permissionReadKB?: boolean
  permissionSendWhatsapp?: boolean
  permissionSendEmail?: boolean
  permissionExecuteTool?: boolean
  permissionCallHuman?: boolean
  permissionCreateTask?: boolean
  permissionReadHistory?: boolean
  permissionReadCommercial?: boolean
  outputFormat?: string | null
  expectedExamples?: string | null
  specificRules?: string | null
}

export type CreateAgentData = {
  tenantId: string
  name: string
  slug: string
  type: AgentType
  category: string
  roleId: string
  operationalFunction: string
  description?: string
  directorId?: string
  mainChannel?: string
  toneOfVoice?: string
  communicationStyle?: string
  autonomyLevel?: string
  responsibilities?: string[]
  permissionReadKB?: boolean
  permissionSendWhatsapp?: boolean
  permissionSendEmail?: boolean
  permissionExecuteTool?: boolean
  permissionCallHuman?: boolean
  permissionCreateTask?: boolean
  permissionReadHistory?: boolean
  permissionReadCommercial?: boolean
  outputFormat?: string
  expectedExamples?: string
  specificRules?: string
}
