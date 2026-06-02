import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublishAgentPrompt } from '@/domains/agent/use-cases/PublishAgentPrompt'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '@/domains/agent/repositories/IAgentPromptVersionRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { AgentStatus, AgentType } from '@/domains/agent/entities/Agent'
import { PromptVersionStatus } from '@/domains/agent/entities/AgentPromptVersion'

function makeAgent(overrides = {}) {
  return {
    id: 'agent-1',
    tenantId: 'tenant-1',
    name: 'SDR Devolus',
    slug: 'sdr-devolus',
    type: AgentType.SDR,
    description: null,
    status: AgentStatus.DRAFT,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makePromptVersion(overrides = {}) {
  return {
    id: 'pv-2',
    agentId: 'agent-1',
    tenantId: 'tenant-1',
    systemPrompt: 'Você é um SDR especializado em imóveis.',
    version: 2,
    status: PromptVersionStatus.ACTIVE,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeRepos() {
  const agentRepo: IAgentRepository = {
    findById: vi.fn().mockResolvedValue(makeAgent()),
    findByName: vi.fn(),
    findBySlug: vi.fn(),
    countActive: vi.fn(),
    listByTenant: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  }
  const promptRepo: IAgentPromptVersionRepository = {
    findActiveByAgent: vi.fn().mockResolvedValue(null),
    getLatestVersion: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue(makePromptVersion()),
    supersedePrevious: vi.fn(),
  }
  const auditLogger: IAuditLogger = { log: vi.fn() }
  return { agentRepo, promptRepo, auditLogger }
}

describe('PublishAgentPrompt', () => {
  let useCase: PublishAgentPrompt
  let agentRepo: IAgentRepository
  let promptRepo: IAgentPromptVersionRepository
  let auditLogger: IAuditLogger

  beforeEach(() => {
    const repos = makeRepos()
    agentRepo = repos.agentRepo
    promptRepo = repos.promptRepo
    auditLogger = repos.auditLogger
    useCase = new PublishAgentPrompt(agentRepo, promptRepo, auditLogger)
  })

  // ── Spec critério: publicação bem-sucedida ────────────────────────────────

  it('deve publicar prompt e criar nova versão ACTIVE', async () => {
    const result = await useCase.execute({
      agentId: 'agent-1',
      tenantId: 'tenant-1',
      systemPrompt: 'Novo prompt com mais de 10 chars.',
    })

    expect(result.promptVersion.status).toBe(PromptVersionStatus.ACTIVE)
    expect(promptRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: PromptVersionStatus.ACTIVE })
    )
  })

  it('deve mover agente de DRAFT para ACTIVE ao publicar primeiro prompt', async () => {
    await useCase.execute({
      agentId: 'agent-1',
      tenantId: 'tenant-1',
      systemPrompt: 'Novo prompt com mais de 10 chars.',
    })

    expect(agentRepo.updateStatus).toHaveBeenCalledWith(
      'agent-1', 'tenant-1', AgentStatus.ACTIVE
    )
  })

  it('não deve alterar status do agente já ACTIVE ao republicar', async () => {
    vi.mocked(agentRepo.findById).mockResolvedValue(makeAgent({ status: AgentStatus.ACTIVE }))

    await useCase.execute({
      agentId: 'agent-1',
      tenantId: 'tenant-1',
      systemPrompt: 'Novo prompt com mais de 10 chars.',
    })

    expect(agentRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('deve chamar supersedePrevious ao publicar quando já existe versão ACTIVE', async () => {
    vi.mocked(promptRepo.findActiveByAgent).mockResolvedValue(
      makePromptVersion({ id: 'pv-1', version: 1, status: PromptVersionStatus.ACTIVE })
    )

    await useCase.execute({
      agentId: 'agent-1',
      tenantId: 'tenant-1',
      systemPrompt: 'Novo prompt com mais de 10 chars.',
    })

    expect(promptRepo.supersedePrevious).toHaveBeenCalledWith('agent-1', 'tenant-1')
  })

  it('deve incrementar versão corretamente (latestVersion + 1)', async () => {
    vi.mocked(promptRepo.getLatestVersion).mockResolvedValue(3)

    await useCase.execute({
      agentId: 'agent-1',
      tenantId: 'tenant-1',
      systemPrompt: 'Novo prompt com mais de 10 chars.',
    })

    expect(promptRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ version: 4 })
    )
  })

  // ── Spec critério: agente ARCHIVED ────────────────────────────────────────

  it('deve rejeitar publicação de prompt em agente ARCHIVED', async () => {
    vi.mocked(agentRepo.findById).mockResolvedValue(makeAgent({ status: AgentStatus.ARCHIVED }))

    await expect(
      useCase.execute({ agentId: 'agent-1', tenantId: 'tenant-1', systemPrompt: 'prompt válido aqui' })
    ).rejects.toMatchObject({ code: 'AGENT_ARCHIVED' })
  })

  // ── Isolamento ────────────────────────────────────────────────────────────

  it('deve retornar AGENT_NOT_FOUND para agente de outro tenant', async () => {
    vi.mocked(agentRepo.findById).mockResolvedValue(null)

    await expect(
      useCase.execute({ agentId: 'agent-1', tenantId: 'tenant-outro', systemPrompt: 'prompt válido aqui' })
    ).rejects.toMatchObject({ code: 'AGENT_NOT_FOUND' })
  })

  // ── Audit ─────────────────────────────────────────────────────────────────

  it('deve registrar publicação no audit log', async () => {
    await useCase.execute({
      agentId: 'agent-1',
      tenantId: 'tenant-1',
      systemPrompt: 'Novo prompt com mais de 10 chars.',
    })

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'agent.prompt.published', tenantId: 'tenant-1' })
    )
  })
})
