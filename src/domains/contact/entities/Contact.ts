export type Contact = {
  id: string
  tenantId: string
  name?: string
  email?: string
  phone?: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export function createContact(params: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Contact {
  return {
    ...params,
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
