import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { IAnalyticsRepository, OverviewMetrics, AgentPerformance } from '@/domains/analytics/repositories/IAnalyticsRepository'

export class PrismaAnalyticsRepository implements IAnalyticsRepository {
  private get prisma() {
    return getPrismaClient()
  }

  async getOverviewMetrics(tenantId: string, daysBack: number): Promise<OverviewMetrics> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)

    const [totalConversations, totalMessages, tokensAgg] = await Promise.all([
      this.prisma.conversation.count({
        where: { tenantId, createdAt: { gte: startDate } }
      }),
      this.prisma.message.count({
        where: { tenantId, createdAt: { gte: startDate } }
      }),
      this.prisma.agentExecutionTrace.aggregate({
        where: { tenantId, createdAt: { gte: startDate } },
        _sum: { totalTokens: true }
      })
    ])

    // Sparklines (agrupamento por dia)
    // Para simplificar, pegaremos o count agrupado e formataremos no formato esperado
    // No Prisma puro precisamos de query bruta (raw) ou agregar na memória para os 'daysBack'
    // Faremos na memória para este exemplo:
    const conversations = await this.prisma.conversation.findMany({
      where: { tenantId, createdAt: { gte: startDate } },
      select: { createdAt: true }
    })

    const sparklines = { conversations: new Array(daysBack).fill(0) }
    
    // Calcula o offset de dias do startDate
    conversations.forEach(c => {
      const diffTime = c.createdAt.getTime() - startDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays >= 0 && diffDays < daysBack) {
        sparklines.conversations[diffDays]++
      }
    })

    // Calcula Handoff Rate
    const handoffs = await this.prisma.conversation.count({
      where: { 
        tenantId, 
        createdAt: { gte: startDate },
        status: { in: ['HANDOFF_REQUESTED', 'HANDOFF_ACCEPTED'] }
      }
    })

    const handoffRate = totalConversations > 0 ? handoffs / totalConversations : 0

    return {
      totalConversations,
      totalMessages,
      totalTokens: tokensAgg._sum.totalTokens ?? 0,
      handoffRate,
      sparklines
    }
  }

  async getAgentMetrics(tenantId: string, daysBack: number): Promise<AgentPerformance[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)

    // Precisamos pegar a contagem de conversas por agente e juntar com tokens e handoffs.
    // Faremos queries agregadas e mesclaremos no JS.
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true, name: true }
    })

    const agentIds = agents.map(a => a.id)

    const [conversationsByAgent, tokensByAgent, handoffsByAgent] = await Promise.all([
      this.prisma.conversation.groupBy({
        by: ['agentId'],
        where: { tenantId, createdAt: { gte: startDate }, agentId: { in: agentIds } },
        _count: { id: true }
      }),
      this.prisma.agentExecutionTrace.groupBy({
        by: ['agentId'],
        where: { tenantId, createdAt: { gte: startDate }, agentId: { in: agentIds } },
        _sum: { totalTokens: true }
      }),
      this.prisma.conversation.groupBy({
        by: ['agentId'],
        where: { 
          tenantId, 
          createdAt: { gte: startDate },
          status: { in: ['HANDOFF_REQUESTED', 'HANDOFF_ACCEPTED'] },
          agentId: { in: agentIds }
        },
        _count: { id: true }
      })
    ])

    return agents.map(agent => {
      const convs = conversationsByAgent.find(c => c.agentId === agent.id)?._count.id || 0
      const tokens = tokensByAgent.find(t => t.agentId === agent.id)?._sum.totalTokens || 0
      const handoffs = handoffsByAgent.find(h => h.agentId === agent.id)?._count.id || 0

      return {
        agentId: agent.id,
        name: agent.name,
        conversationsHandled: convs,
        avgTokensPerConversation: convs > 0 ? tokens / convs : 0,
        handoffRate: convs > 0 ? handoffs / convs : 0
      }
    })
  }
}
