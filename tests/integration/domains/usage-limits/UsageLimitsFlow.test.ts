import { describe, it, expect, beforeEach } from 'vitest'
import { di } from '@/infrastructure/di'
import { InMemoryTenantRepository } from '@/infrastructure/db/repositories/InMemoryTenantRepository'
import { InMemoryAgentRepository } from '@/infrastructure/db/repositories/InMemoryAgentRepository'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { InMemoryTenantUsageCurrentRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageCurrentRepository'
import { InMemoryTenantUsageLimitRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageLimitRepository'
import { AppError } from '@/shared/errors/AppError'

import { vi } from 'vitest'

describe('Usage Limits Flow', () => {
  beforeEach(async () => {
    // Mock LLM dependant calls to prevent JSON parse errors
    vi.spyOn(di.buildRAGContext, 'execute').mockResolvedValue({
      reply: 'Mocked reply',
      model: 'mock',
      tokensUsed: 100,
      chunksUsed: [],
      toolCalls: []
    })

    vi.spyOn((di.sendMessage as any).extractState, 'execute').mockResolvedValue({
      stage: 'QUALIFYING',
      fields: {},
      id: 'mock',
      conversationId: 'mock',
      tenantId: 'mock',
      agentId: 'mock',
      updatedAt: new Date()
    })
  })

  it('should enforce limits and record usage properly', async () => {
    // 1. Setup tenant
    const tenantRepo = di.createTenant as any
    const tenant = await tenantRepo.execute({
      name: 'Test Tenant',
      slug: 'test-tenant-' + Date.now(),
      niche: 'SUPPORT',
      ownerName: 'Owner',
      ownerEmail: 'owner@test.com',
      password: 'password123',
    })

    const tenantId = tenant.tenantId

    // 2. Set limits
    await di.updateUsageLimit.execute({
      tenantId,
      messagesPerMonth: 2, // Limit to 2 messages
      tokensPerMonth: 1000,
    })

    // 2.5 Create Agent Role
    const role = await di.createAgentRole.execute({
      tenantId,
      name: 'Test Support Role',
      category: 'Customer Support',
      requestedByRole: 'TENANT_ADMIN' as any,
    })

    // 3. Create agent
    const agent = await di.createAgent.execute({
      tenantId,
      name: 'Agent Support',
      slug: 'agent-support-' + Date.now(),
      type: 'SUPPORT' as any,
      roleId: role.id,
      category: 'Customer Support',
      operationalFunction: 'Answer questions',
      requestedByRole: 'TENANT_ADMIN' as any,
      systemPrompt: 'You are a helpful customer support agent.',
    })

    // 4. Send messages
    const msg1 = await di.sendMessage.execute({
      tenantId,
      agentId: agent.agent.id,
      message: 'Hello 1',
    })

    expect(msg1.reply).toBeDefined()
    expect(msg1.tokensUsed).toBeGreaterThanOrEqual(0)

    const msg2 = await di.sendMessage.execute({
      tenantId,
      agentId: agent.agent.id,
      message: 'Hello 2',
      conversationId: msg1.conversationId,
    })

    expect(msg2.reply).toBeDefined()

    // 5. Attempt third message should fail (limit 2)
    await expect(
      di.sendMessage.execute({
        tenantId,
        agentId: agent.agent.id,
        message: 'Hello 3',
        conversationId: msg1.conversationId,
      })
    ).rejects.toThrowError(AppError)

    // 6. Verify usage
    const usage = await di.checkUsageLimit.execute({ tenantId })
    expect(usage.allowed).toBe(false)
    expect(usage.reason).toBe('QUOTA_MESSAGES')
    expect(usage.currentUsage.messages).toBe(2)
  })
})
