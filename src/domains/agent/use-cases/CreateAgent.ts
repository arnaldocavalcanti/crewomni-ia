import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { MAX_ACTIVE_AGENTS_PER_TENANT } from '@/shared/constants'
import { UserRole } from '@/domains/auth/entities/User'
import { AgentStatus, AgentType } from '../entities/Agent'
import { PromptVersionStatus } from '../entities/AgentPromptVersion'
import type { IAgentRepository } from '../repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '../repositories/IAgentPromptVersionRepository'
import type { Agent } from '../entities/Agent'
import type { AgentPromptVersion } from '../entities/AgentPromptVersion'

const AGENT_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{1,2}$/
const ALLOWED_ROLES = [UserRole.TENANT_ADMIN, UserRole.TENANT_OPERATOR]

type CreateAgentInput = {
  tenantId: string
  name: string
  slug: string
  type: AgentType
  description?: string
  systemPrompt: string
  requestedByRole: UserRole
}

type CreateAgentOutput = {
  agent: Agent
  promptVersion: AgentPromptVersion
}

export class CreateAgent {
  constructor(
    private agentRepo: IAgentRepository,
    private promptRepo: IAgentPromptVersionRepository,
    private auditLogger: IAuditLogger,
    private maxActiveAgents: number = MAX_ACTIVE_AGENTS_PER_TENANT,
  ) {}

  async execute(input: CreateAgentInput): Promise<CreateAgentOutput> {
    if (!ALLOWED_ROLES.includes(input.requestedByRole)) {
      throw new AppError('FORBIDDEN', 'Apenas administradores e operadores podem criar agentes')
    }

    this.validateSlug(input.slug)
    this.validatePrompt(input.systemPrompt)

    const [byName, bySlug, activeCount] = await Promise.all([
      this.agentRepo.findByName(input.name, input.tenantId),
      this.agentRepo.findBySlug(input.slug, input.tenantId),
      this.agentRepo.countActive(input.tenantId),
    ])

    if (byName) throw new AppError('AGENT_NAME_TAKEN', 'Já existe um agente com este nome neste tenant')
    if (bySlug) throw new AppError('SLUG_ALREADY_TAKEN', 'Já existe um agente com este slug neste tenant')
    if (activeCount >= this.maxActiveAgents) {
      throw new AppError('AGENT_LIMIT_REACHED', `Limite de ${this.maxActiveAgents} agentes ativos atingido`)
    }

    const agent = await this.agentRepo.create({
      tenantId: input.tenantId,
      name: input.name,
      slug: input.slug,
      type: input.type,
      description: input.description,
    })

    const promptVersion = await this.promptRepo.create({
      agentId: agent.id,
      tenantId: input.tenantId,
      systemPrompt: input.systemPrompt,
      version: 1,
      status: PromptVersionStatus.DRAFT,
    })

    await this.auditLogger.log({
      action: 'agent.created',
      tenantId: input.tenantId,
      resourceId: agent.id,
      resourceType: 'agent',
      metadata: { name: agent.name, type: agent.type },
    })

    return { agent, promptVersion }
  }

  private validateSlug(slug: string): void {
    if (!AGENT_SLUG_REGEX.test(slug) || /\s/.test(slug)) {
      throw new AppError('VALIDATION_ERROR', 'Slug deve conter apenas letras minúsculas, números e hífens')
    }
  }

  private validatePrompt(prompt: string): void {
    if (prompt.trim().length < 10) {
      throw new AppError('VALIDATION_ERROR', 'System prompt deve ter no mínimo 10 caracteres')
    }
  }
}
