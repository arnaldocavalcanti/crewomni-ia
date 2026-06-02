import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetAgent } from '@/domains/agent/use-cases/GetAgent'
import { ListAgents } from '@/domains/agent/use-cases/ListAgents'
import { UpdateAgentStatus } from '@/domains/agent/use-cases/UpdateAgentStatus'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '@/domains/agent/repositories/IAgentPromptVersionRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { AgentStatus, AgentType } from '@/domains/agent/entities/Agent'
import { PromptVersionStatus } from '@/domains/agent/entities/AgentPromptVersion'
import { UserRole } from '@/domains/auth/entities/User'

function makeAgent(overrides = {}) {
  return {
    id: 'agent-1',
    tenantId: 'tenant-1',
    name: 'SDR Devolus',
    slug: 'sdr-devolus',
    type: AgentType.SDR,
    description: null,
    status: AgentStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeActivePrompt() {
  return {
    id: 'pv-1',
    agentId: 'agent-1',
    tenantId: 'tenant-1',
    systemPrompt: 'Você é um SDR especializado em imóveis.',
    version: 1,
    status: PromptVersionStatus.ACTIVE,
    createdAt: new Date(),
  }
}

function makeRepos() {
  const agentRepo: IAgentRepository = {
    findById: vi.fn().mockResolvedValue(makeAgent()),
    findByName: vi.fn(),
    findBySlug: vi.fn(),
    countActive: vi.fn(),
    listByTenant: vi.fn().mockResolvedValue([makeAgent(), makeAgent({ id: 'agent-2', name: 'Helpdesk' })]),
    create: vi.fn(),
    updateStatus: vi.fn(),
  }
  const promptRepo: IAgentPromptVersionRepository = {
    findActiveByAgent: vi.fn().mockResolvedValue(makeActivePrompt()),
    getLatestVersion: vi.fn(),
    create: vi.fn(),
    supersedePrevious: vi.fn(),
  }
  const auditLogger: IAuditLogger = { log: vi.fn() }
  return { agentRepo, promptRepo, auditLogger }
}

// ─── GetAgent ─────────────────────────────────────────────────────────────────

describe('GetAgent', () => {
  let useCase: GetAgent
  let agentRepo: IAgentRepository
  let promptRepo: IAgentPromptVersionRepository

  beforeEach(() => {
    const repos = makeRepos()
    agentRepo = repos.agentRepo
    promptRepo = repos.promptRepo
    useCase = new GetAgent(agentRepo, promptRepo)
  })

  it('deve retornar agente com versão de prompt ativa', async () => {
    const result = await useCase.execute({ agentId: 'agent-1', tenantId: 'tenant-1' })

    expect(result).not.toBeNull()
    expect(result!.id).toBe('agent-1')
    expect(result!.activePromptVersion).not.toBeNull()
    expect(result!.activePromptVersion!.systemPrompt).toBeDefined()
  })

  it('deve retornar null para agente de outro tenant (isolamento)', async () => {
    vi.mocked(agentRepo.findById).mockResolvedValue(null)

    const result = await useCase.execute({ agentId: 'agent-1', tenantId: 'tenant-outro' })

    expect(result).toBeNull()
  })

  it('deve retornar activePromptVersion null se agente não tem prompt ativo', async () => {
    vi.mocked(promptRepo.findActiveByAgent).mockResolvedValue(null)

    const result = await useCase.execute({ agentId: 'agent-1', tenantId: 'tenant-1' })

    expect(result!.activePromptVersion).toBeNull()
  })
})

// ─── ListAgents ───────────────────────────────────────────────────────────────

describe('ListAgents', () => {
  let useCase: ListAgents
  let agentRepo: IAgentRepository
  let promptRepo: IAgentPromptVersionRepository

  beforeEach(() => {
    const repos = makeRepos()
    agentRepo = repos.agentRepo
    promptRepo = repos.promptRepo
    useCase = new ListAgents(agentRepo, promptRepo)
  })

  it('deve listar apenas agentes do tenant da sessão', async () => {
    const result = await useCase.execute({ tenantId: 'tenant-1' })

    expect(agentRepo.listByTenant).toHaveBeenCalledWith('tenant-1')
    expect(result.length).toBe(2)
  })

  it('não deve incluir systemPrompt na listagem', async () => {
    const result = await useCase.execute({ tenantId: 'tenant-1' })

    const asJson = JSON.stringify(result)
    expect(asJson).not.toContain('systemPrompt')
    expect(asJson).not.toContain('Você é um SDR')
  })
})

// ─── UpdateAgentStatus ────────────────────────────────────────────────────────

describe('UpdateAgentStatus', () => {
  let useCase: UpdateAgentStatus
  let agentRepo: IAgentRepository
  let auditLogger: IAuditLogger

  beforeEach(() => {
    const repos = makeRepos()
    agentRepo = repos.agentRepo
    auditLogger = repos.auditLogger
    useCase = new UpdateAgentStatus(agentRepo, auditLogger)
  })

  it('deve arquivar agente corretamente', async () => {
    await useCase.execute({
      agentId: 'agent-1',
      tenantId: 'tenant-1',
      status: AgentStatus.ARCHIVED,
      requestedByRole: UserRole.TENANT_ADMIN,
    })

    expect(agentRepo.updateStatus).toHaveBeenCalledWith('agent-1', 'tenant-1', AgentStatus.ARCHIVED)
  })

  it('deve retornar AGENT_NOT_FOUND para agente de outro tenant', async () => {
    vi.mocked(agentRepo.findById).mockResolvedValue(null)

    await expect(
      useCase.execute({
        agentId: 'agent-1',
        tenantId: 'tenant-outro',
        status: AgentStatus.ARCHIVED,
        requestedByRole: UserRole.TENANT_ADMIN,
      })
    ).rejects.toMatchObject({ code: 'AGENT_NOT_FOUND' })
  })

  it('deve rejeitar usuário sem permissão', async () => {
    await expect(
      useCase.execute({
        agentId: 'agent-1',
        tenantId: 'tenant-1',
        status: AgentStatus.ARCHIVED,
        requestedByRole: UserRole.KDL_APPROVER,
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('deve registrar mudança de status no audit log', async () => {
    await useCase.execute({
      agentId: 'agent-1',
      tenantId: 'tenant-1',
      status: AgentStatus.ARCHIVED,
      requestedByRole: UserRole.TENANT_ADMIN,
    })

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'agent.status.updated', tenantId: 'tenant-1' })
    )
  })
})
