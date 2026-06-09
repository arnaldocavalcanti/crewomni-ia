import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import { PrismaContactRepository } from '@/infrastructure/db/repositories/PrismaContactRepository'
import { PrismaContactChannelIdentityRepository } from '@/infrastructure/db/repositories/PrismaContactChannelIdentityRepository'
import { PrismaConversationLifecycleRepository } from '@/infrastructure/db/repositories/PrismaConversationLifecycleRepository'
import { PrismaTraceRepository } from '@/infrastructure/db/repositories/PrismaTraceRepository'
import { PrismaConversationSummaryRepository } from '@/infrastructure/db/repositories/PrismaConversationSummaryRepository'
import { PrismaContactMemoryRepository } from '@/infrastructure/db/repositories/PrismaContactMemoryRepository'

const prisma = getPrismaClient()

async function setDBTenant(tenantId: string | null) {
  if (tenantId) {
    await prisma.$executeRawUnsafe(`SET app.current_tenant_id = '${tenantId}'`)
  } else {
    await prisma.$executeRawUnsafe(`RESET app.current_tenant_id`)
  }
}

describe('Harness RLS Integration Tests', () => {
  const contactRepo = new PrismaContactRepository()
  const identityRepo = new PrismaContactChannelIdentityRepository()
  const lifecycleRepo = new PrismaConversationLifecycleRepository()
  const traceRepo = new PrismaTraceRepository()
  const summaryRepo = new PrismaConversationSummaryRepository()
  const contactMemoryRepo = new PrismaContactMemoryRepository()

  beforeEach(async () => {
    await setDBTenant(null)
    await prisma.contactMemory.deleteMany()
    await prisma.conversationSummary.deleteMany()
    await prisma.agentExecutionTrace.deleteMany()
    await prisma.conversationLifecycleEvent.deleteMany()
    await prisma.contactChannelIdentity.deleteMany()
    await prisma.contact.deleteMany()
    await prisma.conversation.deleteMany()
    await prisma.agent.deleteMany()
    await prisma.agentRole.deleteMany()
    await prisma.tenant.deleteMany()

    // Garante que o role de teste para RLS existe e tem privilégios
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'test_rls_user') THEN
          CREATE ROLE test_rls_user;
        END IF;
      END
      $$;
    `)
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO test_rls_user;`)
    await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO test_rls_user;`)
    await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO test_rls_user;`)
    await prisma.$executeRawUnsafe(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO test_rls_user;`)

    // Cria tenant de teste
    await prisma.tenant.create({
      data: { id: 'tenant-A', name: 'Tenant A', slug: 'tenant-a', plan: 'PRO', niche: 'SUPPORT' }
    })
    await prisma.tenant.create({
      data: { id: 'tenant-B', name: 'Tenant B', slug: 'tenant-b', plan: 'PRO', niche: 'SUPPORT' }
    })

    // Cria agente e conversa base para chaves estrangeiras
    await prisma.agentRole.create({
      data: { id: 'role-1', name: 'Support', category: 'Customer Support' }
    })
    await prisma.agent.create({
      data: { id: 'agent-1', tenantId: 'tenant-A', name: 'Agent 1', slug: 'agent-1', type: 'SUPPORT', roleId: 'role-1', category: 'Customer Support', operationalFunction: 'Suporte' }
    })
    await prisma.conversation.create({
      data: { id: 'conv-A', tenantId: 'tenant-A', agentId: 'agent-1', status: 'ACTIVE' }
    })
  })

  afterEach(async () => {
    await setDBTenant(null)
  })

  it('deve isolar contatos e identidades entre tenants diferentes usando RLS', async () => {
    // 1. Salva contato no tenant A
    await setDBTenant('tenant-A')
    const contact = {
      id: 'contact-1',
      tenantId: 'tenant-A',
      name: 'Cliente A',
      email: 'a@a.com',
      phone: '+5511999999999',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await contactRepo.save(contact)

    const identity = {
      id: 'identity-1',
      tenantId: 'tenant-A',
      contactId: 'contact-1',
      channel: 'WHATSAPP' as const,
      provider: 'meta',
      externalId: '+5511999999999',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await identityRepo.save(identity)

    // 2. Verifica que tenant A consegue ler o contato e a identidade
    const foundContactA = await contactRepo.findById('contact-1', 'tenant-A')
    expect(foundContactA).not.toBeNull()
    expect(foundContactA?.name).toBe('Cliente A')

    const foundIdentityA = await identityRepo.findByExternalId('tenant-A', 'WHATSAPP', 'meta', '+5511999999999')
    expect(foundIdentityA).not.toBeNull()

    // 3. Muda conexão para tenant B e tenta ler o contato/identidade do tenant A
    // Usamos transação para garantir que a mesma conexão seja usada para SET LOCAL e consulta
    const rlsResultB = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = 'tenant-B'`)
      await tx.$executeRawUnsafe(`SET ROLE test_rls_user`)
      const contact = await tx.contact.findUnique({ where: { id: 'contact-1' } })
      const identity = await tx.contactChannelIdentity.findFirst({
        where: { contactId: 'contact-1', channel: 'WHATSAPP', provider: 'meta', externalId: '+5511999999999' }
      })
      await tx.$executeRawUnsafe(`RESET ROLE`)
      return { contact, identity }
    })
    expect(rlsResultB.contact).toBeNull()
    expect(rlsResultB.identity).toBeNull()
  })

  it('deve isolar traces, summaries, memories e lifecycle_events', async () => {
    await setDBTenant('tenant-A')

    // 1. Lifecycle Event
    await lifecycleRepo.save({
      id: 'event-1',
      tenantId: 'tenant-A',
      conversationId: 'conv-A',
      fromStatus: 'ACTIVE',
      toStatus: 'WAITING_USER',
      actor: 'AGENT',
      createdAt: new Date(),
    })

    // 2. Trace
    await traceRepo.createTrace({
      id: 'trace-1',
      tenantId: 'tenant-A',
      conversationId: 'conv-A',
      agentId: 'agent-1',
      channel: 'WHATSAPP',
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedCostUsd: 0.002,
      chunksUsed: [],
      memoryBlocksUsed: [],
      durationMs: 1200,
      status: 'COMPLETED',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 3. Summary
    await summaryRepo.upsert({
      id: 'summary-1',
      tenantId: 'tenant-A',
      conversationId: 'conv-A',
      summary: 'Resumo de teste',
      lastSummarizedMessageId: 'msg-1',
      summaryVersion: 1,
      tokenCount: 40,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 4. Memory
    await contactMemoryRepo.save({
      id: 'memory-1',
      tenantId: 'tenant-A',
      contactId: 'contact-1',
      memoryType: 'FACT',
      content: 'Gosta de café',
      sourceConversationId: 'conv-A',
      confidence: 1.0,
      status: 'ACTIVE',
      shouldPersist: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 5. Testar que tenant A lê normalmente
    const eventsA = await lifecycleRepo.findByConversationId('conv-A', 'tenant-A')
    expect(eventsA).toHaveLength(1)

    const summaryA = await summaryRepo.findByConversationId('conv-A', 'tenant-A')
    expect(summaryA).not.toBeNull()

    const tracesA = await traceRepo.findByConversation('conv-A', 'tenant-A')
    expect(tracesA).toHaveLength(1)

    const memoriesA = await contactMemoryRepo.findActiveByContactId('contact-1', 'tenant-A')
    expect(memoriesA).toHaveLength(1)

    // 6. Mudar para tenant B e garantir isolamento
    // Usamos transação para garantir que a mesma conexão seja usada para SET LOCAL e consulta
    const rlsResultEventsB = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = 'tenant-B'`)
      await tx.$executeRawUnsafe(`SET ROLE test_rls_user`)
      const events = await tx.conversationLifecycleEvent.findMany({ where: { conversationId: 'conv-A' } })
      const summary = await tx.conversationSummary.findFirst({ where: { conversationId: 'conv-A' } })
      const traces = await tx.agentExecutionTrace.findMany({ where: { conversationId: 'conv-A' } })
      const memories = await tx.contactMemory.findMany({ where: { contactId: 'contact-1' } })
      await tx.$executeRawUnsafe(`RESET ROLE`)
      return { events, summary, traces, memories }
    })

    expect(rlsResultEventsB.events).toHaveLength(0)
    expect(rlsResultEventsB.summary).toBeNull()
    expect(rlsResultEventsB.traces).toHaveLength(0)
    expect(rlsResultEventsB.memories).toHaveLength(0)
  })
})
