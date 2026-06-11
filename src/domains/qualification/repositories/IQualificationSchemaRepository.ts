import type { QualificationSchema, CreateQualificationSchemaData } from '../entities/QualificationSchema'

export interface IQualificationSchemaRepository {
  create(data: CreateQualificationSchemaData): Promise<QualificationSchema>
  findById(id: string): Promise<QualificationSchema | null>
  findByNicheKey(nicheKey: string, tenantId: string | null): Promise<QualificationSchema | null>
  findGlobalByNicheKey(nicheKey: string): Promise<QualificationSchema | null>
  findAllByTenant(tenantId: string): Promise<QualificationSchema[]>
}
