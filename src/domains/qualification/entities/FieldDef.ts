export type FieldDefType = 'enum' | 'string' | 'integer' | 'boolean'

export type FieldDef = {
  key: string
  type: FieldDefType
  enum?: string[]
  min?: number
  max?: number
  label?: string
}
