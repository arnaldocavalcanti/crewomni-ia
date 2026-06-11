import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateAgent } from '@/domains/agent/use-cases/CreateAgent'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { IAgentRoleRepository } from '@/domains/agent/repositories/IAgentRoleRepository'
import type { IAgentPromptVersionRepository } from '@/domains/agent/repositories/IAgentPromptVersionRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { AgentStatus, AgentType } from '@/domains/agent/entities/Agent'
import { PromptVersionStatus } from '@/domains/agent/entities/AgentPromptVersion'
import { UserRole } from '@/domains/auth/entities/User'

// ─── Factories ───────────────────────────────────────────────────────────────

const mockRole = {
  id: 'role-1',
  tenantId: null, // global role
  name: 'SDR',
  category: 'Comercial',
  description: 'Prospecção e qualificação de leads',
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeAgent(overrides = {}) {
  return {
    id: 'agent-1',
    tenantId: 'tenant-1',
    name: 'SDR Devolus',
    slug: 'sdr-devolus',
    type: AgentType.SDR,
    category: 'Comercial',
    roleId: 'role-1',
    departmentId: 'dept-1',
    operationalFunction: 'Conversacional',
    description: null,
    status: AgentStatus.DRAFT,
    directorId: null,
    mainChannel: null,
    toneOfVoice: null,
    communicationStyle: null,
    autonomyLevel: null,
    responsibilities: [],
    permissionReadKB: true,
    permissionSendWhatsapp: false,
    permissionSendEmail: false,
    permissionExecuteTool: false,
    permissionCallHuman: false,
    permissionCreateTask: false,
    permissionReadHistory: false,
    permissionReadCommercial: false,
    outputFormat: null,
    expectedExamples: null,
    specificRules: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makePromptVersion(overrides = {}) {
  return {
    id: 'pv-1',
    agentId: 'agent-1',
    tenantId: 'tenant-1',
    systemPrompt: 'Você é um SDR especializado em imóveis.',
    version: 1,
    status: PromptVersionStatus.DRAFT,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeInput(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    name: 'SDR Devolus',
    slug: 'sdr-devolus',
    category: 'Comercial',
    roleId: 'role-1',
    operationalFunction: 'Conversacional',
    systemPrompt: 'Você é um SDR especializado em imóveis.',
    requestedByRole: UserRole.TENANT_ADMIN,
    ...overrides,
  }
}

function makeRepos() {
  const agentRepo: IAgentRepository = {
    findById: vi.fn(),
    findByName: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    countActive: vi.fn().mockResolvedValue(0),
    listByTenant: vi.fn(),
    create: vi.fn().mockResolvedValue(makeAgent()),
    updateStatus: vi.fn(), update: vi.fn(),
  }
  const promptRepo: IAgentPromptVersionRepository = {
    findActiveByAgent: vi.fn(),
    findLatestByAgent: vi.fn(),
    getLatestVersion: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(makePromptVersion()),
    supersedePrevious: vi.fn(),
  }
  const roleRepo: IAgentRoleRepository = {
    findById: vi.fn().mockResolvedValue(mockRole),
    findByName: vi.fn().mockResolvedValue(null),
    list: vi.fn(),
    create: vi.fn(),
  }
  const auditLogger: IAuditLogger = { log: vi.fn() }
  return { agentRepo, promptRepo, roleRepo, auditLogger }
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('CreateAgent', () => {
  let useCase: CreateAgent
  let agentRepo: IAgentRepository
  let promptRepo: IAgentPromptVersionRepository
  let roleRepo: IAgentRoleRepository
  let auditLogger: IAuditLogger

  beforeEach(() => {
    const repos = makeRepos()
    agentRepo = repos.agentRepo
    promptRepo = repos.promptRepo
    roleRepo = repos.roleRepo
    auditLogger = repos.auditLogger
    useCase = new CreateAgent(agentRepo, promptRepo, roleRepo, auditLogger, 10)
  })

  // ── Spec critério 1: criação bem-sucedida ─────────────────────────────────

  it('deve criar agente com status DRAFT e prompt v1 associado', async () => {
    const result = await useCase.execute(makeInput())

    expect(result.agent.status).toBe(AgentStatus.DRAFT)
    expect(result.agent.tenantId).toBe('tenant-1')
    expect(result.promptVersion.version).toBe(1)
    expect(result.promptVersion.status).toBe(PromptVersionStatus.DRAFT)
    expect(agentRepo.create).toHaveBeenCalledOnce()
    expect(promptRepo.create).toHaveBeenCalledOnce()
  })

  // ── Spec critério 2: nome duplicado ──────────────────────────────────────

  it('deve rejeitar nome duplicado no mesmo tenant', async () => {
    vi.mocked(agentRepo.findByName).mockResolvedValue(makeAgent())

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({
      code: 'AGENT_NAME_TAKEN',
    })
  })

  // ── Spec critério 3: slug duplicado ──────────────────────────────────────

  it('deve rejeitar slug duplicado no mesmo tenant', async () => {
    vi.mocked(agentRepo.findBySlug).mockResolvedValue(makeAgent())

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({
      code: 'SLUG_ALREADY_TAKEN',
    })
  })

  // ── Spec critério 4: limite de agentes ───────────────────────────────────

  it('deve rejeitar quando limite de agentes ativos for atingido', async () => {
    vi.mocked(agentRepo.countActive).mockResolvedValue(10)

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({
      code: 'AGENT_LIMIT_REACHED',
    })
  })

  it('deve usar o limite injetado como parâmetro', async () => {
    const limitedUseCase = new CreateAgent(agentRepo, promptRepo, roleRepo, auditLogger, 2)
    vi.mocked(agentRepo.countActive).mockResolvedValue(2)

    await expect(limitedUseCase.execute(makeInput())).rejects.toMatchObject({
      code: 'AGENT_LIMIT_REACHED',
    })
  })

  // ── Spec critério 5: permissão ────────────────────────────────────────────

  it('deve rejeitar usuário com role KDL_APPROVER', async () => {
    await expect(
      useCase.execute(makeInput({ requestedByRole: UserRole.KDL_APPROVER }))
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('deve rejeitar usuário com role PLATFORM_ADMIN acessando tenant', async () => {
    await expect(
      useCase.execute(makeInput({ requestedByRole: UserRole.PLATFORM_ADMIN }))
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('deve aceitar TENANT_OPERATOR como criador de agente', async () => {
    const result = await useCase.execute(makeInput({ requestedByRole: UserRole.TENANT_OPERATOR }))
    expect(result.agent).toBeDefined()
  })

  // ── Spec critério 6: validação ───────────────────────────────────────────

  it('deve rejeitar systemPrompt com menos de 10 caracteres', async () => {
    await expect(
      useCase.execute(makeInput({ systemPrompt: 'curto' }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('deve rejeitar slug com caracteres inválidos', async () => {
    await expect(
      useCase.execute(makeInput({ slug: 'SDR Devolus' }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  // ── Roles & Compatibilidade ──────────────────────────────────────────────

  it('deve rejeitar se o papel do agente não existir', async () => {
    vi.mocked(roleRepo.findById).mockResolvedValue(null)

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({
      code: 'ROLE_NOT_FOUND',
    })
  })

  it('deve rejeitar se o papel pertencer a outro tenant', async () => {
    vi.mocked(roleRepo.findById).mockResolvedValue({
      ...mockRole,
      tenantId: 'outro-tenant',
    })

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({
      code: 'ROLE_NOT_FOUND',
    })
  })

  it('deve mapear AgentType compatível com base no papel e categoria', async () => {
    // Caso 1: Suporte / Helpdesk
    vi.mocked(roleRepo.findById).mockResolvedValue({
      id: 'role-helpdesk',
      tenantId: null,
      name: 'Helpdesk N1',
      category: 'Suporte',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await useCase.execute(makeInput({ roleId: 'role-helpdesk', category: 'Suporte' }))
    expect(agentRepo.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: AgentType.HELPDESK })
    )

    // Caso 2: Atendimento / Onboarding
    vi.mocked(roleRepo.findById).mockResolvedValue({
      id: 'role-onboarding',
      tenantId: null,
      name: 'Onboarding Agent',
      category: 'Atendimento',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await useCase.execute(makeInput({ roleId: 'role-onboarding', category: 'Atendimento' }))
    expect(agentRepo.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: AgentType.ONBOARDING })
    )
  })

  // ── Audit log ─────────────────────────────────────────────────────────────

  it('deve registrar criação no audit log', async () => {
    await useCase.execute(makeInput())

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'agent.created', tenantId: 'tenant-1' })
    )
  })
})
