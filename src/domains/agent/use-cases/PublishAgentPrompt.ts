import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { AgentStatus } from '../entities/Agent'
import { PromptVersionStatus } from '../entities/AgentPromptVersion'
import type { AgentPromptVersion } from '../entities/AgentPromptVersion'
import type { IAgentRepository } from '../repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '../repositories/IAgentPromptVersionRepository'

type PublishAgentPromptInput = {
  agentId: string
  tenantId: string
  systemPrompt: string
}

type PublishAgentPromptOutput = {
  promptVersion: AgentPromptVersion
}

export class PublishAgentPrompt {
  constructor(
    private agentRepo: IAgentRepository,
    private promptRepo: IAgentPromptVersionRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: PublishAgentPromptInput): Promise<PublishAgentPromptOutput> {
    const agent = await this.agentRepo.findById(input.agentId, input.tenantId)
    if (!agent) throw new AppError('AGENT_NOT_FOUND', 'Agente não encontrado')
    if (agent.status === AgentStatus.ARCHIVED) throw new AppError('AGENT_ARCHIVED', 'Agente arquivado não aceita novos prompts')

    await this.promptRepo.supersedePrevious(input.agentId, input.tenantId)

    const nextVersion = (await this.promptRepo.getLatestVersion(input.agentId)) + 1

    const promptVersion = await this.promptRepo.create({
      agentId: input.agentId,
      tenantId: input.tenantId,
      systemPrompt: input.systemPrompt,
      version: nextVersion,
      status: PromptVersionStatus.ACTIVE,
    })

    if (agent.status === AgentStatus.DRAFT) {
      await this.agentRepo.updateStatus(input.agentId, input.tenantId, AgentStatus.ACTIVE)
    }

    await this.auditLogger.log({
      action: 'agent.prompt.published',
      tenantId: input.tenantId,
      resourceId: input.agentId,
      resourceType: 'agent',
      metadata: { version: nextVersion },
    })

    return { promptVersion }
  }
}
