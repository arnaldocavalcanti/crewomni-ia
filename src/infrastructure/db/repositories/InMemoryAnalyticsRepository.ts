import type { IAnalyticsRepository, OverviewMetrics, AgentPerformance } from '@/domains/analytics/repositories/IAnalyticsRepository'

export class InMemoryAnalyticsRepository implements IAnalyticsRepository {
  async getOverviewMetrics(tenantId: string, daysBack: number): Promise<OverviewMetrics> {
    return {
      totalConversations: 150,
      totalMessages: 450,
      totalTokens: 12000,
      handoffRate: 0.1,
      sparklines: {
        conversations: new Array(daysBack).fill(10).map((v, i) => v + i)
      }
    }
  }

  async getAgentMetrics(tenantId: string, daysBack: number): Promise<AgentPerformance[]> {
    return [
      {
        agentId: 'agent-1',
        name: 'Agent Support',
        conversationsHandled: 100,
        avgTokensPerConversation: 80,
        handoffRate: 0.05
      },
      {
        agentId: 'agent-2',
        name: 'Agent Sales',
        conversationsHandled: 50,
        avgTokensPerConversation: 100,
        handoffRate: 0.20
      }
    ]
  }
}
