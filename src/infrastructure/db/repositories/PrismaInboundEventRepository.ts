import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { IInboundEventRepository } from '@/domains/channel/repositories/IInboundEventRepository'
import type { InboundEvent } from '@/domains/channel/entities/InboundEvent'
import type { InboundEventStatus, NormalizedMessage } from '@/domains/channel/entities/Channel'

export class PrismaInboundEventRepository implements IInboundEventRepository {
  private get db() {
    return getPrismaClient()
  }

  async save(event: InboundEvent): Promise<void> {
    await this.db.inboundEvent.create({ data: event as any })
  }

  async findByProviderMessageId(
    tenantId: string,
    provider: string,
    providerMessageId: string
  ): Promise<InboundEvent | null> {
    const record = await this.db.inboundEvent.findUnique({
      where: {
        tenantId_provider_providerMessageId: {
          tenantId,
          provider,
          providerMessageId,
        },
      },
    })
    return record ? (record as unknown as InboundEvent) : null
  }

  async findById(id: string, tenantId: string): Promise<InboundEvent | null> {
    const record = await this.db.inboundEvent.findUnique({
      where: { id },
    })
    if (!record || record.tenantId !== tenantId) return null
    return record as unknown as InboundEvent
  }

  async updateStatus(
    id: string,
    status: InboundEventStatus,
    extra?: { processedAt?: Date; error?: string; attemptCount?: number }
  ): Promise<void> {
    await this.db.inboundEvent.update({
      where: { id },
      data: {
        status,
        ...(extra?.processedAt && { processedAt: extra.processedAt }),
        ...(extra?.error && { error: extra.error }),
        ...(extra?.attemptCount !== undefined && { attemptCount: extra.attemptCount }),
      },
    })
  }

  async updateNormalized(id: string, normalized: NormalizedMessage): Promise<void> {
    await this.db.inboundEvent.update({
      where: { id },
      data: { normalizedPayload: normalized as any },
    })
  }

  async findDeadLetters(tenantId: string, limit: number): Promise<InboundEvent[]> {
    const records = await this.db.inboundEvent.findMany({
      where: { tenantId, status: 'DEAD_LETTER' },
      take: limit,
      orderBy: { createdAt: 'asc' },
    })
    return records as unknown as InboundEvent[]
  }
}
