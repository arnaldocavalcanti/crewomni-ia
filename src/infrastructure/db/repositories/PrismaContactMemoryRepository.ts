import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { IContactMemoryRepository } from '@/domains/memory-policy/repositories/IContactMemoryRepository'
import type { ContactMemory, ContactMemoryStatus } from '@/domains/memory-policy/entities/ContactMemory'

export class PrismaContactMemoryRepository implements IContactMemoryRepository {
  private get db() {
    return getPrismaClient()
  }

  async findActiveByContactId(contactId: string, tenantId: string): Promise<ContactMemory[]> {
    const records = await this.db.contactMemory.findMany({
      where: { contactId, tenantId, status: 'ACTIVE' },
    })
    return records as unknown as ContactMemory[]
  }

  async save(memory: ContactMemory): Promise<void> {
    await this.db.contactMemory.create({ data: memory as any })
  }

  async updateStatus(id: string, status: ContactMemoryStatus, tenantId: string): Promise<void> {
    await this.db.contactMemory.updateMany({
      where: { id, tenantId },
      data: { status, updatedAt: new Date() },
    })
  }

  async findCandidatesByTenant(tenantId: string, limit: number): Promise<ContactMemory[]> {
    const records = await this.db.contactMemory.findMany({
      where: { tenantId, status: 'CANDIDATE' },
      take: limit,
      orderBy: { createdAt: 'asc' },
    })
    return records as unknown as ContactMemory[]
  }
}
