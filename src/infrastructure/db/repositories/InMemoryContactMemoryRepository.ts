import type { IContactMemoryRepository } from '@/domains/memory-policy/repositories/IContactMemoryRepository'
import type { ContactMemory, ContactMemoryStatus } from '@/domains/memory-policy/entities/ContactMemory'

export class InMemoryContactMemoryRepository implements IContactMemoryRepository {
  private store: ContactMemory[] = []

  async findActiveByContactId(contactId: string, tenantId: string) {
    return this.store.filter(m => m.contactId === contactId && m.tenantId === tenantId && m.status === 'ACTIVE')
  }

  async save(memory: ContactMemory) { this.store.push({ ...memory }) }

  async updateStatus(id: string, status: ContactMemoryStatus, tenantId: string) {
    const idx = this.store.findIndex(m => m.id === id && m.tenantId === tenantId)
    if (idx >= 0) this.store[idx] = { ...this.store[idx], status, updatedAt: new Date() }
  }

  async findCandidatesByTenant(tenantId: string, limit: number) {
    return this.store.filter(m => m.tenantId === tenantId && m.status === 'CANDIDATE').slice(0, limit)
  }
}
