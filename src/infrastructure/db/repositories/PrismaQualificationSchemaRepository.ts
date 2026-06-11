import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import type { QualificationSchema, CreateQualificationSchemaData } from '@/domains/qualification/entities/QualificationSchema'
import type { IQualificationSchemaRepository } from '@/domains/qualification/repositories/IQualificationSchemaRepository'
import type { FieldDef } from '@/domains/qualification/entities/FieldDef'

export class PrismaQualificationSchemaRepository implements IQualificationSchemaRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any { return getPrismaClient() }

  async create(data: CreateQualificationSchemaData): Promise<QualificationSchema> {
    const r = await this.db.qualificationSchema.create({
      data: {
        tenantId: data.tenantId,
        nicheKey: data.nicheKey,
        version: data.version,
        fields: data.fields,
        order: data.order,
      },
    })
    return this.toEntity(r)
  }

  async findById(id: string): Promise<QualificationSchema | null> {
    const r = await this.db.qualificationSchema.findUnique({
      where: { id },
    })
    return r ? this.toEntity(r) : null
  }

  async findByNicheKey(nicheKey: string, tenantId: string | null): Promise<QualificationSchema | null> {
    const r = await this.db.qualificationSchema.findFirst({
      where: { nicheKey, tenantId },
      orderBy: { version: 'desc' },
    })
    return r ? this.toEntity(r) : null
  }

  async findGlobalByNicheKey(nicheKey: string): Promise<QualificationSchema | null> {
    const r = await this.db.qualificationSchema.findFirst({
      where: { nicheKey, tenantId: null },
      orderBy: { version: 'desc' },
    })
    return r ? this.toEntity(r) : null
  }

  async findAllByTenant(tenantId: string): Promise<QualificationSchema[]> {
    const records = await this.db.qualificationSchema.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r: any) => this.toEntity(r))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toEntity(r: any): QualificationSchema {
    return {
      id: r.id,
      tenantId: r.tenantId,
      nicheKey: r.nicheKey,
      version: r.version,
      fields: r.fields as FieldDef[],
      order: r.order as string[],
      createdAt: r.createdAt,
    }
  }
}
