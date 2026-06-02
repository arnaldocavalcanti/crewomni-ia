import { describe, it, expect, vi } from 'vitest'
import { GetAgent } from '@/domains/agent/use-cases/GetAgent'
import { ListAgents } from '@/domains/agent/use-cases/ListAgents'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '@/domains/agent/repositories/IAgentPromptVersionRepository'
import { AgentStatus, AgentType } from '@/domains/agent/entities/Agent'
import { PromptVersionStatus } from '@/domains/agent/entities/AgentPromptVersion'

/**
 * Testes de isolamento — domínio agent.
 * Spec: docs/specs/agent/create-agent.md — seção 13.
 */

const agentA = {
  id: 'agent-a',
  tenantId: 'tenant-a',
  name: 'SDR Devolus',
  slug: 'sdr-devolus',
  type: AgentType.SDR,
  description: null,
  status: AgentStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const agentB = {
  id: 'agent-b',
  tenantId: 'tenant-b',
  name: 'Helpdesk Fast4Sign',
  slug: 'helpdesk-fast4sign',
  type: AgentType.HELPDESK,
  description: null,
  status: AgentStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const activePromptA = {
  id: 'pv-a',
  agentId: 'agent-a',
  tenantId: 'tenant-a',
  systemPrompt: 'Prompt secreto da Devolus',
  version: 1,
  status: PromptVersionStatus.ACTIVE,
  createdAt: new Date(),
}

function makeAgentRepo(): IAgentRepository {
  return {
    findById: vi.fn((id: string, tenantId: string) => {
      if (id === 'agent-a' && tenantId === 'tenant-a') return Promise.resolve(agentA)
      if (id === 'agent-b' && tenantId === 'tenant-b') return Promise.resolve(agentB)
      return Promise.resolve(null)
    }),
    findByName: vi.fn(),
    findBySlug: vi.fn(),
    countActive: vi.fn(),
    listByTenant: vi.fn((tenantId: string) => {
      if (tenantId === 'tenant-a') return Promise.resolve([agentA])
      if (tenantId === 'tenant-b') return Promise.resolve([agentB])
      return Promise.resolve([])
    }),
    create: vi.fn(),
    updateStatus: vi.fn(),
  }
}

function makePromptRepo(): IAgentPromptVersionRepository {
  return {
    findActiveByAgent: vi.fn((agentId: string, tenantId: string) => {
      if (agentId === 'agent-a' && tenantId === 'tenant-a') return Promise.resolve(activePromptA)
      return Promise.resolve(null)
    }),
    getLatestVersion: vi.fn(),
    create: vi.fn(),
    supersedePrevious: vi.fn(),
  }
}

describe('Agent Isolation', () => {
  const agentRepo = makeAgentRepo()
  const promptRepo = makePromptRepo()
  const getAgent = new GetAgent(agentRepo, promptRepo)
  const listAgents = new ListAgents(agentRepo, promptRepo)

  // ── GetAgent: tenant A não acessa agente de tenant B ─────────────────────

  it('tenant A não deve acessar agente de tenant B via GetAgent', async () => {
    const result = await getAgent.execute({ agentId: 'agent-b', tenantId: 'tenant-a' })
    expect(result).toBeNull()
  })

  it('tenant B não deve acessar agente de tenant A via GetAgent', async () => {
    const result = await getAgent.execute({ agentId: 'agent-a', tenantId: 'tenant-b' })
    expect(result).toBeNull()
  })

  // ── GetAgent: prompt secreto de A não vaza para B ─────────────────────────

  it('tenant B não deve ver o systemPrompt do agente de tenant A', async () => {
    const resultA = await getAgent.execute({ agentId: 'agent-a', tenantId: 'tenant-a' })
    const resultB_spy = await getAgent.execute({ agentId: 'agent-a', tenantId: 'tenant-b' })

    expect(resultA!.activePromptVersion!.systemPrompt).toContain('Devolus')
    expect(resultB_spy).toBeNull()
  })

  // ── ListAgents: cada tenant só vê os próprios agentes ────────────────────

  it('ListAgents de tenant A só retorna agentes de tenant A', async () => {
    const result = await listAgents.execute({ tenantId: 'tenant-a' })

    expect(result.every((a) => a.tenantId === 'tenant-a')).toBe(true)
    expect(result.some((a) => a.tenantId === 'tenant-b')).toBe(false)
  })

  it('ListAgents de tenant B só retorna agentes de tenant B', async () => {
    const result = await listAgents.execute({ tenantId: 'tenant-b' })

    expect(result.every((a) => a.tenantId === 'tenant-b')).toBe(true)
    expect(result.some((a) => a.tenantId === 'tenant-a')).toBe(false)
  })

  // ── systemPrompt nunca aparece em listagem ────────────────────────────────

  it('systemPrompt não deve aparecer em nenhum item da listagem', async () => {
    const result = await listAgents.execute({ tenantId: 'tenant-a' })
    const asJson = JSON.stringify(result)

    expect(asJson).not.toContain('systemPrompt')
    expect(asJson).not.toContain('Prompt secreto')
  })
})
