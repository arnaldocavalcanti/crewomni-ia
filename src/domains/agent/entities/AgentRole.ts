export type AgentRole = {
  id: string
  tenantId: string | null // null = global, string = customizado por tenant
  name: string
  category: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export type CreateAgentRoleData = {
  tenantId?: string | null
  name: string
  category: string
  description?: string
}
