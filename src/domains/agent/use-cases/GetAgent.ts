import type { IAgentRepository } from '../repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '../repositories/IAgentPromptVersionRepository'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import type { Agent } from '../entities/Agent'
import type { AgentPromptVersion } from '../entities/AgentPromptVersion'

type GetAgentInput = {
  agentId: string
  tenantId: string
}

export type AgentWithPrompt = Agent & {
  activePromptVersion: AgentPromptVersion | null
  crewMembership: { id: string; crewId: string; role: string } | null
}

export class GetAgent {
  constructor(
    private agentRepo: IAgentRepository,
    private promptRepo: IAgentPromptVersionRepository,
    private crewMemberRepo: ICrewMemberRepository,
  ) {}

  async execute(input: GetAgentInput): Promise<AgentWithPrompt | null> {
    const agent = await this.agentRepo.findById(input.agentId, input.tenantId)
    if (!agent) return null

    const activePromptVersion =
      (await this.promptRepo.findActiveByAgent(input.agentId, input.tenantId)) ??
      (await this.promptRepo.findLatestByAgent(input.agentId, input.tenantId))

    const membership = await this.crewMemberRepo.findFirstByAgent(input.agentId, input.tenantId)
    const crewMembership = membership
      ? { id: membership.id, crewId: membership.crewId, role: membership.role }
      : null

    return { ...agent, activePromptVersion, crewMembership }
  }
}
