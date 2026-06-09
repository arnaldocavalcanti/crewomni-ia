import { describe, it, expect } from 'vitest'
import { RecordExecutionTrace } from '@/domains/observability/use-cases/RecordExecutionTrace'
import { InMemoryTraceRepository } from '@/infrastructure/db/repositories/InMemoryTraceRepository'

describe('RecordExecutionTrace', () => {
  it('deve criar trace com status STARTED', async () => {
    const repo = new InMemoryTraceRepository()
    const uc = new RecordExecutionTrace(repo)
    const trace = await uc.start({
      tenantId: 'tenant-1', conversationId: 'conv-1',
      agentId: 'agent-1', channel: 'WHATSAPP',
    })
    expect(trace.id).toBeDefined()
    expect(trace.status).toBe('STARTED')
  })

  it('deve completar trace com custo calculado', async () => {
    const repo = new InMemoryTraceRepository()
    const uc = new RecordExecutionTrace(repo)
    const trace = await uc.start({ tenantId: 'tenant-1', conversationId: 'conv-1', agentId: 'agent-1', channel: 'WHATSAPP' })
    await uc.complete(trace.id, 'tenant-1', {
      model: 'gpt-4o-mini', inputTokens: 500, outputTokens: 100,
      durationMs: 2000, chunksUsed: [], memoryBlocksUsed: [],
    })
    const updated = (await repo.findByConversation('conv-1', 'tenant-1'))[0]
    expect(updated.status).toBe('COMPLETED')
    expect(updated.estimatedCostUsd).toBeGreaterThan(0)
    expect(updated.totalTokens).toBe(600)
  })

  it('falha ao persistir nao deve lancar excecao', async () => {
    const brokenRepo = {
      createTrace: async () => { throw new Error('DB down') },
      updateTrace: async () => {},
      findByConversation: async () => [],
      getTenantUsageSummary: async () => ({ totalTokens: 0, totalCostUsd: 0, totalTurns: 0 }),
    }
    const uc = new RecordExecutionTrace(brokenRepo as any)
    await expect(uc.start({ tenantId: 't', conversationId: 'c', agentId: 'a', channel: 'WHATSAPP' }))
      .resolves.not.toThrow()
  })
})
