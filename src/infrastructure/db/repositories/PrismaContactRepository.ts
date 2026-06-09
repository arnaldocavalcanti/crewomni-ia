import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { IContactRepository } from '@/domains/contact/repositories/IContactRepository'
import type { Contact } from '@/domains/contact/entities/Contact'

export class PrismaContactRepository implements IContactRepository {
  private get db() {
    return getPrismaClient()
  }

  async findById(id: string, tenantId: string): Promise<Contact | null> {
    const record = await this.db.contact.findUnique({ where: { id } })
    if (!record || record.tenantId !== tenantId) return null
    return record as unknown as Contact
  }

  async findByPhone(phone: string, tenantId: string): Promise<Contact | null> {
    const record = await this.db.contact.findFirst({ where: { phone, tenantId } })
    return record ? (record as unknown as Contact) : null
  }

  async save(contact: Contact): Promise<void> {
    await this.db.contact.create({ data: contact as any })
  }

  async update(id: string, tenantId: string, partial: Partial<Contact>): Promise<void> {
    await this.db.contact.updateMany({
      where: { id, tenantId },
      data: partial as any,
    })
  }
}
