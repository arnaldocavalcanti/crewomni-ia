import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { MAX_ACTIVE_AGENTS_PER_TENANT } from '@/shared/constants'
import { UserRole } from '@/domains/auth/entities/User'
import { AgentStatus, AgentType } from '../entities/Agent'
import { PromptVersionStatus } from '../entities/AgentPromptVersion'
import type { IAgentRepository } from '../repositories/IAgentRepository'
import type { IAgentRoleRepository } from '../repositories/IAgentRoleRepository'
import type { IAgentPromptVersionRepository } from '../repositories/IAgentPromptVersionRepository'
import type { Agent } from '../entities/Agent'
import type { AgentPromptVersion } from '../entities/AgentPromptVersion'

const AGENT_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{1,2}$/
const ALLOWED_ROLES = [UserRole.TENANT_ADMIN, UserRole.TENANT_OPERATOR]

type CreateAgentInput = {
  tenantId: string
  name: string
  slug: string
  category: string
  roleId: string
  operationalFunction: string
  type?: AgentType
  description?: string
  systemPrompt: string
  requestedByRole: UserRole

  // Contexto Organizacional & Responsável
  departmentId?: string
  directorId?: string
  mainChannel?: string

  // Comportamento & Autonomia
  toneOfVoice?: string
  communicationStyle?: string
  autonomyLevel?: string
  responsibilities?: string[]

  // Permissões e Ferramentas
  permissionReadKB?: boolean
  permissionSendWhatsapp?: boolean
  permissionSendEmail?: boolean
  permissionExecuteTool?: boolean
  permissionCallHuman?: boolean
  permissionCreateTask?: boolean
  permissionReadHistory?: boolean
  permissionReadCommercial?: boolean

  // Diretivas e Formatos
  outputFormat?: string
  expectedExamples?: string
  specificRules?: string
}

type CreateAgentOutput = {
  agent: Agent
  promptVersion: AgentPromptVersion
}

export class CreateAgent {
  constructor(
    private agentRepo: IAgentRepository,
    private promptRepo: IAgentPromptVersionRepository,
    private roleRepo: IAgentRoleRepository,
    private auditLogger: IAuditLogger,
    private maxActiveAgents: number = MAX_ACTIVE_AGENTS_PER_TENANT,
  ) {}

  async execute(input: CreateAgentInput): Promise<CreateAgentOutput> {
    if (!ALLOWED_ROLES.includes(input.requestedByRole)) {
      throw new AppError('FORBIDDEN', 'Apenas administradores e operadores podem criar agentes')
    }

    this.validateSlug(input.slug)
    this.validatePrompt(input.systemPrompt)

    // Validate role exists and belongs to the tenant or is global
    const role = await this.roleRepo.findById(input.roleId)
    if (!role) {
      throw new AppError('ROLE_NOT_FOUND', 'O papel do agente selecionado não existe')
    }
    if (role.tenantId !== null && role.tenantId !== input.tenantId) {
      throw new AppError('ROLE_NOT_FOUND', 'O papel do agente selecionado não existe')
    }

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

    const computedType = this.computeAgentType(input.category, role.name)

    const agent = await this.agentRepo.create({
      tenantId: input.tenantId,
      name: input.name,
      slug: input.slug,
      type: input.type || computedType,
      category: input.category,
      roleId: input.roleId,
      operationalFunction: input.operationalFunction,
      description: input.description,

      departmentId: input.departmentId,
      directorId: input.directorId,
      mainChannel: input.mainChannel,
      toneOfVoice: input.toneOfVoice,
      communicationStyle: input.communicationStyle,
      autonomyLevel: input.autonomyLevel,
      responsibilities: input.responsibilities,

      permissionReadKB: input.permissionReadKB,
      permissionSendWhatsapp: input.permissionSendWhatsapp,
      permissionSendEmail: input.permissionSendEmail,
      permissionExecuteTool: input.permissionExecuteTool,
      permissionCallHuman: input.permissionCallHuman,
      permissionCreateTask: input.permissionCreateTask,
      permissionReadHistory: input.permissionReadHistory,
      permissionReadCommercial: input.permissionReadCommercial,

      outputFormat: input.outputFormat,
      expectedExamples: input.expectedExamples,
      specificRules: input.specificRules,
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
      metadata: { name: agent.name, type: agent.type, roleId: agent.roleId },
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

  private computeAgentType(category: string, roleName: string): AgentType {
    const cat = category.toLowerCase()
    const role = roleName.toLowerCase()

    if (cat === 'comercial') {
      if (role.includes('negotiator') || role.includes('proposal') || role.includes('closer')) {
        return AgentType.NEGOTIATION
      }
      return AgentType.SDR
    }
    if (cat === 'suporte') {
      if (role.includes('helpdesk') || role.includes('n1') || role.includes('n2')) {
        return AgentType.HELPDESK
      }
      return AgentType.SUPPORT
    }
    if (cat === 'atendimento') {
      if (role.includes('onboarding')) {
        return AgentType.ONBOARDING
      }
      return AgentType.SUPPORT
    }
    return AgentType.SALES
  }
}
