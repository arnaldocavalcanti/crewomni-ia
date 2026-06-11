import type { FieldDef } from './FieldDef'

export type QualificationSchema = {
  id: string
  tenantId: string | null   // null = schema global da plataforma (somente leitura)
  nicheKey: string
  version: number
  fields: FieldDef[]
  order: string[]           // ordem de coleta (chaves dos campos)
  createdAt: Date
}

export type CreateQualificationSchemaData = {
  tenantId: string | null
  nicheKey: string
  version: number
  fields: FieldDef[]
  order: string[]
}
