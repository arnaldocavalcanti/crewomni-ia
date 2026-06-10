import type { IAgentRepository } from '../repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '../repositories/IAgentPromptVersionRepository'
import type { IAgentRoleRepository } from '../repositories/IAgentRoleRepository'
import type { Agent } from '../entities/Agent'
import type { PromptVersionStatus } from '../entities/AgentPromptVersion'

type ListAgentsInput = {
  tenantId: string
}

export type AgentListItem = Agent & {
  roleName: string
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
    private roleRepo: IAgentRoleRepository,
  ) {}

  async execute(input: ListAgentsInput): Promise<AgentListItem[]> {
    const [agents, roles] = await Promise.all([
      this.agentRepo.listByTenant(input.tenantId),
      this.roleRepo.list(input.tenantId),
    ])

    const rolesMap = new Map(roles.map((r) => [r.id, r.name]))

    return Promise.all(
      agents.map(async (agent) => {
        const prompt = await this.promptRepo.findActiveByAgent(agent.id, input.tenantId)
        return {
          ...agent,
          roleName: rolesMap.get(agent.roleId) || 'N/A',
          activePromptVersion: prompt
            ? { id: prompt.id, version: prompt.version, status: prompt.status, createdAt: prompt.createdAt }
            : null,
        }
      }),
    )
  }
}
