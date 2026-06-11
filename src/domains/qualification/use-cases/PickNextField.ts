import type { QualificationSchema } from '../entities/QualificationSchema'
import type { QualificationState } from '../entities/QualificationState'

export type PickNextFieldInput = {
  schema: QualificationSchema
  state: QualificationState
}

// Pure, synchronous — no LLM, no side effects
export function pickNextField(input: PickNextFieldInput): string | null {
  const schemaKeys = new Set(input.schema.fields.map((f) => f.key))
  for (const key of input.schema.order) {
    if (!schemaKeys.has(key)) continue
    const val = input.state.fields[key]
    if (val === null || val === undefined || val === '') return key
  }
  return null
}
