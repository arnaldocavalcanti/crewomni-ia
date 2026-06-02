import type { IAgentRepository } from '../repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '../repositories/IAgentPromptVersionRepository'
import type { Agent } from '../entities/Agent'
import type { AgentPromptVersion } from '../entities/AgentPromptVersion'

type GetAgentInput = {
  agentId: string
  tenantId: string
}

export type AgentWithPrompt = Agent & {
  activePromptVersion: AgentPromptVersion | null
}

export class GetAgent {
  constructor(
    private agentRepo: IAgentRepository,
    private promptRepo: IAgentPromptVersionRepository,
  ) {}

  async execute(input: GetAgentInput): Promise<AgentWithPrompt | null> {
    const agent = await this.agentRepo.findById(input.agentId, input.tenantId)
    if (!agent) return null

    const activePromptVersion = await this.promptRepo.findActiveByAgent(input.agentId, input.tenantId)

    return { ...agent, activePromptVersion }
  }
}
