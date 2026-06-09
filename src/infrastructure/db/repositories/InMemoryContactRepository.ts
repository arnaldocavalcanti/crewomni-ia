import type { IContactRepository } from '@/domains/contact/repositories/IContactRepository'
import type { Contact } from '@/domains/contact/entities/Contact'

export class InMemoryContactRepository implements IContactRepository {
  private store: Map<string, Contact> = new Map()

  async findById(id: string, tenantId: string): Promise<Contact | null> {
    const c = this.store.get(id)
    return c?.tenantId === tenantId ? { ...c } : null
  }

  async findByPhone(phone: string, tenantId: string): Promise<Contact | null> {
    return [...this.store.values()].find(c => c.phone === phone && c.tenantId === tenantId) ?? null
  }

  async save(contact: Contact): Promise<void> {
    this.store.set(contact.id, { ...contact })
  }

  async update(id: string, tenantId: string, partial: Partial<Contact>): Promise<void> {
    const c = this.store.get(id)
    if (c && c.tenantId === tenantId) this.store.set(id, { ...c, ...partial, updatedAt: new Date() })
  }
}
