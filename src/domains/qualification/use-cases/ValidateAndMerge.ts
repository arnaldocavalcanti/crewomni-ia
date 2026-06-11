import { z } from 'zod'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { IQualificationStateRepository } from '../repositories/IQualificationStateRepository'
import type { QualificationSchema } from '../entities/QualificationSchema'
import type { FieldDef } from '../entities/FieldDef'
import type { QualificationState, QualificationFields } from '../entities/QualificationState'

export type ExtractionDelta = {
  field: string
  value: unknown
  evidence: string | null
}

export type ValidateAndMergeInput = {
  state: QualificationState
  schema: QualificationSchema
  delta: ExtractionDelta[]
}

export type ValidateAndMergeOutput = {
  newState: QualificationState
  changedKeys: string[]
  rejectedKeys: string[]
}

export class ValidateAndMerge {
  constructor(
    private stateRepo: IQualificationStateRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: ValidateAndMergeInput): Promise<ValidateAndMergeOutput> {
    const changedKeys: string[] = []
    const rejectedKeys: string[] = []
    const updatedFields: QualificationFields = { ...input.state.fields }

    const fieldMap = new Map(input.schema.fields.map((f) => [f.key, f]))

    for (const { field, value, evidence } of input.delta) {
      const fieldDef = fieldMap.get(field)
      if (!fieldDef) continue // field not in schema — silently discard

      const zodSchema = buildZodSchema(fieldDef)
      const parsed = zodSchema.safeParse(value)

      if (!parsed.success) {
        rejectedKeys.push(field)
        continue
      }

      const currentValue = updatedFields[field]
      const hasCurrentValue = currentValue !== null && currentValue !== undefined && currentValue !== ''

      if (hasCurrentValue && !evidence) {
        // Protect existing value — no evidence provided
        rejectedKeys.push(field)
        continue
      }

      updatedFields[field] = parsed.data as string | number | boolean | null
      changedKeys.push(field)
    }

    const newState = await this.stateRepo.update(input.state.id, input.state.tenantId, {
      fields: updatedFields,
    })

    await this.auditLogger.log({
      action: 'qualification.state.merged',
      tenantId: input.state.tenantId,
      metadata: {
        conversationId: input.state.conversationId,
        agentId: input.state.agentId,
        changedKeys,
        rejectedKeys,
      },
    })

    return { newState, changedKeys, rejectedKeys }
  }
}

function buildZodSchema(field: FieldDef): z.ZodTypeAny {
  switch (field.type) {
    case 'enum':
      if (field.enum && field.enum.length > 0) {
        return z.enum(field.enum as [string, ...string[]])
      }
      return z.string()

    case 'integer': {
      let schema = z.number().int()
      if (field.min !== undefined) schema = schema.min(field.min)
      if (field.max !== undefined) schema = schema.max(field.max)
      return schema
    }

    case 'boolean':
      return z.boolean()

    case 'string':
    default:
      return z.string().min(1)
  }
}
