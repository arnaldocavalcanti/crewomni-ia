export interface OverviewMetrics {
  totalConversations: number
  totalMessages: number
  totalTokens: number
  handoffRate: number
  sparklines: {
    conversations: number[] // Ex: últimos X dias
  }
}

export interface AgentPerformance {
  agentId: string
  name: string
  conversationsHandled: number
  avgTokensPerConversation: number
  handoffRate: number
}

export interface IAnalyticsRepository {
  getOverviewMetrics(tenantId: string, daysBack: number): Promise<OverviewMetrics>
  getAgentMetrics(tenantId: string, daysBack: number): Promise<AgentPerformance[]>
}
