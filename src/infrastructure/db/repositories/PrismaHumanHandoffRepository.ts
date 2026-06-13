import type { PrismaClient } from '@prisma/client'
import type { IHumanHandoffRepository } from '@/domains/conversation/repositories/IHumanHandoffRepository'
import type { HumanHandoff } from '@/domains/conversation/entities/HumanHandoff'

export class PrismaHumanHandoffRepository implements IHumanHandoffRepository {
  constructor(private prisma: PrismaClient) {}

  async save(handoff: HumanHandoff): Promise<void> {
    await this.prisma.humanHandoff.upsert({
      where: { conversationId: handoff.conversationId },
      create: {
        id: handoff.id,
        tenantId: handoff.tenantId,
        conversationId: handoff.conversationId,
        reason: handoff.reason,
        contactPhone: handoff.contactPhone,
        webhookSent: handoff.webhookSent,
        waSentAt: handoff.waSentAt,
        webhookSentAt: handoff.webhookSentAt,
        createdAt: handoff.createdAt,
      },
      update: {
        webhookSent: handoff.webhookSent,
        waSentAt: handoff.waSentAt,
        webhookSentAt: handoff.webhookSentAt,
      },
    })
  }

  async findByConversationId(conversationId: string, tenantId: string): Promise<HumanHandoff | null> {
    const row = await this.prisma.humanHandoff.findUnique({
      where: { conversationId },
    })
    if (!row || row.tenantId !== tenantId) return null
    return {
      id: row.id,
      tenantId: row.tenantId,
      conversationId: row.conversationId,
      reason: row.reason,
      contactPhone: row.contactPhone,
      webhookSent: row.webhookSent,
      waSentAt: row.waSentAt,
      webhookSentAt: row.webhookSentAt,
      createdAt: row.createdAt,
    }
  }
}
