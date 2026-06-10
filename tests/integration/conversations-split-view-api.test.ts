import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getDetails } from '@/app/api/v1/conversations/[id]/route'
import { POST as acceptHandoff } from '@/app/api/v1/conversations/[id]/accept-handoff/route'
import { POST as requestHandoff } from '@/app/api/v1/conversations/[id]/request-handoff/route'
import { POST as closeConversation } from '@/app/api/v1/conversations/[id]/close/route'
import { getSession } from '@/shared/guards/withSession'
import { di } from '@/infrastructure/di'
import { ConversationStatus } from '@/domains/conversation/entities/Conversation'

import { getPrismaClient } from '@/infrastructure/db/prisma/client'

vi.mock('@/shared/guards/withSession', () => ({
  getSession: vi.fn(),
}))

describe('Conversations Split-View API Routes', () => {
  const tenantId = 'tenant-A'
  const userId = 'operator-1'

  beforeEach(async () => {
    vi.clearAllMocks()
    // Mock getSession to return a valid session
    vi.mocked(getSession).mockResolvedValue({
      userId,
      tenantId,
      role: 'TENANT_OPERATOR' as any,
      isPlatformAdmin: false,
    })

    const prisma = getPrismaClient()
    await prisma.conversationLifecycleEvent.deleteMany()
    await prisma.message.deleteMany()
    await prisma.conversation.deleteMany()
    await prisma.agent.deleteMany()
    await prisma.agentRole.deleteMany()
    await prisma.tenant.deleteMany()

    await prisma.tenant.create({
      data: { id: 'tenant-A', name: 'Tenant A', slug: 'tenant-a', plan: 'PRO', niche: 'SUPPORT' }
    })
    await prisma.tenant.create({
      data: { id: 'tenant-B', name: 'Tenant B', slug: 'tenant-b', plan: 'PRO', niche: 'SUPPORT' }
    })
    await prisma.agentRole.create({
      data: { id: 'role-1', name: 'Support', category: 'Customer Support' }
    })
    await prisma.agent.create({
      data: { id: 'agent-1', tenantId: 'tenant-A', name: 'Agent 1', slug: 'agent-1', type: 'SUPPORT', roleId: 'role-1', category: 'Customer Support', operationalFunction: 'Suporte' }
    })
  })

  it('GET /api/v1/conversations/:id should call getConversationDetails use case', async () => {
    // Setup conversation
    const conv = await di.listConversations['repo'].createConversation({
      tenantId,
      agentId: 'agent-1',
    })

    const req = new NextRequest(`http://localhost/api/v1/conversations/${conv.id}`)
    const res = await getDetails(req, { params: Promise.resolve({ id: conv.id }) })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.conversationId).toBe(conv.id)
    expect(data.status).toBe(ConversationStatus.OPEN)
    expect(Array.isArray(data.messages)).toBe(true)
    expect(data.qualificationState).toBeNull()
  })

  it('POST /api/v1/conversations/:id/accept-handoff should transition to HANDOFF_ACCEPTED', async () => {
    const conv = await di.listConversations['repo'].createConversation({
      tenantId,
      agentId: 'agent-1',
    })
    // Move status to ACTIVE so it can be transitioned
    await di.listConversations['repo'].updateConversationStatus(conv.id, 'ACTIVE', tenantId)

    // First, request handoff (ACTIVE → HANDOFF_REQUESTED)
    const reqRequest = new NextRequest(`http://localhost/api/v1/conversations/${conv.id}/request-handoff`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Lead requires human assistance' }),
    })
    const resRequest = await requestHandoff(reqRequest, { params: Promise.resolve({ id: conv.id }) })
    expect(resRequest.status).toBe(200)
    const dataRequest = await resRequest.json()
    expect(dataRequest.currentStatus).toBe('HANDOFF_REQUESTED')

    // Then, accept handoff (HANDOFF_REQUESTED → HANDOFF_ACCEPTED)
    const req = new NextRequest(`http://localhost/api/v1/conversations/${conv.id}/accept-handoff`, {
      method: 'POST',
    })
    const res = await acceptHandoff(req, { params: Promise.resolve({ id: conv.id }) })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.currentStatus).toBe('HANDOFF_ACCEPTED')
  })

  it('POST /api/v1/conversations/:id/request-handoff should transition to HANDOFF_REQUESTED', async () => {
    const conv = await di.listConversations['repo'].createConversation({
      tenantId,
      agentId: 'agent-1',
    })
    await di.listConversations['repo'].updateConversationStatus(conv.id, 'ACTIVE', tenantId)

    const req = new NextRequest(`http://localhost/api/v1/conversations/${conv.id}/request-handoff`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Lead requested human' }),
    })
    const res = await requestHandoff(req, { params: Promise.resolve({ id: conv.id }) })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.currentStatus).toBe('HANDOFF_REQUESTED')
  })

  it('POST /api/v1/conversations/:id/close should close the conversation', async () => {
    const conv = await di.listConversations['repo'].createConversation({
      tenantId,
      agentId: 'agent-1',
    })

    const req = new NextRequest(`http://localhost/api/v1/conversations/${conv.id}/close`, {
      method: 'POST',
    })
    const res = await closeConversation(req, { params: Promise.resolve({ id: conv.id }) })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.status).toBe('CLOSED')
  })

  it('should restrict access to conversations of another tenant', async () => {
    // Create conversation on tenant B
    const conv = await di.listConversations['repo'].createConversation({
      tenantId: 'tenant-B',
      agentId: 'agent-1',
    })

    const req = new NextRequest(`http://localhost/api/v1/conversations/${conv.id}`)
    const res = await getDetails(req, { params: Promise.resolve({ id: conv.id }) })
    // Should throw 404 (revealing nothing)
    expect(res.status).toBe(404)
  })
})
