import type { IAgentRepository } from '../repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '../repositories/IAgentPromptVersionRepository'
import type { Agent } from '../entities/Agent'
import type { PromptVersionStatus } from '../entities/AgentPromptVersion'

type ListAgentsInput = {
  tenantId: string
}

export type AgentListItem = Agent & {
  activePromptVersion: {
    id: string
    version: number
    status: PromptVersionStatus
    createdAt: Date
  } | null
}

export class ListAgents {
  constructor(
    private agentRepo: IAgentRepository,
    private promptRepo: IAgentPromptVersionRepository,
  ) {}

  async execute(input: ListAgentsInput): Promise<AgentListItem[]> {
    const agents = await this.agentRepo.listByTenant(input.tenantId)

    return Promise.all(
      agents.map(async (agent) => {
        const prompt = await this.promptRepo.findActiveByAgent(agent.id, input.tenantId)
        return {
          ...agent,
          activePromptVersion: prompt
            ? { id: prompt.id, version: prompt.version, status: prompt.status, createdAt: prompt.createdAt }
            : null,
        }
      }),
    )
  }
}
