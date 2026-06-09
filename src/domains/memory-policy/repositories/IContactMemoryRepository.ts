import type { ContactMemory, ContactMemoryStatus } from '../entities/ContactMemory'

export interface IContactMemoryRepository {
  findActiveByContactId(contactId: string, tenantId: string): Promise<ContactMemory[]>
  save(memory: ContactMemory): Promise<void>
  updateStatus(id: string, status: ContactMemoryStatus, tenantId: string): Promise<void>
  findCandidatesByTenant(tenantId: string, limit: number): Promise<ContactMemory[]>
}
