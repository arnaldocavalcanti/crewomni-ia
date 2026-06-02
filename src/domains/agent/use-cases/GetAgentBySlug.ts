import type { IAgentRepository } from '../repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '../repositories/IAgentPromptVersionRepository'
import type { AgentWithPrompt } from './GetAgent'

type GetAgentBySlugInput = {
  slug: string
  tenantId: string
}

export class GetAgentBySlug {
  constructor(
    private agentRepo: IAgentRepository,
    private promptRepo: IAgentPromptVersionRepository,
  ) {}

  async execute(input: GetAgentBySlugInput): Promise<AgentWithPrompt | null> {
    const agent = await this.agentRepo.findBySlug(input.slug, input.tenantId)
    if (!agent) return null

    const activePromptVersion = await this.promptRepo.findActiveByAgent(agent.id, input.tenantId)
    return { ...agent, activePromptVersion }
  }
}
