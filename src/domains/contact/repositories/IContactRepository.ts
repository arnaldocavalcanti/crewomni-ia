import type { Contact } from '../entities/Contact'

export interface IContactRepository {
  findById(id: string, tenantId: string): Promise<Contact | null>
  findByPhone(phone: string, tenantId: string): Promise<Contact | null>
  save(contact: Contact): Promise<void>
  update(id: string, tenantId: string, partial: Partial<Contact>): Promise<void>
}
