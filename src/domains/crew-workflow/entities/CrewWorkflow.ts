export type WorkflowNode = {
  id: string
  type: 'agent' | 'condition' | 'wait'
  agentId?: string // apenas se type for agent
  label?: string
  position?: { x: number; y: number }
}

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  condition?: string // regex ou valor exato para ramificações
}

export type CrewWorkflow = {
  id: string
  tenantId: string
  crewId: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt: Date
  updatedAt: Date
}

export type CreateCrewWorkflowData = {
  tenantId: string
  crewId: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}
