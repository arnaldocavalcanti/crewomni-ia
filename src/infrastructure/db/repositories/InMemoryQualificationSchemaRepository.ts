import { randomUUID } from 'crypto'
import type { QualificationSchema, CreateQualificationSchemaData } from '@/domains/qualification/entities/QualificationSchema'
import type { IQualificationSchemaRepository } from '@/domains/qualification/repositories/IQualificationSchemaRepository'

const store = new Map<string, QualificationSchema>()

export class InMemoryQualificationSchemaRepository implements IQualificationSchemaRepository {
  async create(data: CreateQualificationSchemaData): Promise<QualificationSchema> {
    const schema: QualificationSchema = {
      id: randomUUID(),
      tenantId: data.tenantId,
      nicheKey: data.nicheKey,
      version: data.version,
      fields: data.fields,
      order: data.order,
      createdAt: new Date(),
    }
    store.set(schema.id, schema)
    return schema
  }

  async findById(id: string): Promise<QualificationSchema | null> {
    return store.get(id) ?? null
  }

  async findByNicheKey(nicheKey: string, tenantId: string | null): Promise<QualificationSchema | null> {
    return (
      Array.from(store.values())
        .filter((s) => s.nicheKey === nicheKey && s.tenantId === tenantId)
        .sort((a, b) => b.version - a.version)[0] ?? null
    )
  }

  async findGlobalByNicheKey(nicheKey: string): Promise<QualificationSchema | null> {
    return (
      Array.from(store.values())
        .filter((s) => s.nicheKey === nicheKey && s.tenantId === null)
        .sort((a, b) => b.version - a.version)[0] ?? null
    )
  }

  async findAllByTenant(tenantId: string): Promise<QualificationSchema[]> {
    return Array.from(store.values()).filter((s) => s.tenantId === tenantId)
  }

  clear(): void {
    store.clear()
  }

  seed(data: CreateQualificationSchemaData): Promise<QualificationSchema> {
    return this.create(data)
  }
}
