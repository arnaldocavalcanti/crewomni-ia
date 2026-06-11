export const ConversationStage = {
  QUALIFYING: 'QUALIFYING',
  PRICE_INQUIRY: 'PRICE_INQUIRY',
  OBJECTION: 'OBJECTION',
  DEMO_SCHEDULED: 'DEMO_SCHEDULED',
  CONTACT_COLLECTED: 'CONTACT_COLLECTED',
  CLOSED: 'CLOSED',
} as const

export type ConversationStage = (typeof ConversationStage)[keyof typeof ConversationStage]

export const LeadIntent = {
  QUALIFICATION_ANSWER: 'QUALIFICATION_ANSWER',
  PRICE_INQUIRY: 'PRICE_INQUIRY',
  OBJECTION: 'OBJECTION',
  CONTACT_SHARED: 'CONTACT_SHARED',
  VIDEO_REQUEST: 'VIDEO_REQUEST',
  GREETING: 'GREETING',
  OTHER: 'OTHER',
} as const

export type LeadIntent = (typeof LeadIntent)[keyof typeof LeadIntent]

// Dynamic fields — keyed by schema field keys; values are primitives or null
export type QualificationFields = Record<string, string | number | boolean | null>

export type QualificationState = {
  id: string
  conversationId: string
  tenantId: string
  agentId: string
  schemaId: string | null   // null during backfill; resolved after migration
  stage: ConversationStage
  lastIntent: LeadIntent | null
  fields: QualificationFields
  updatedAt: Date
}

export type CreateQualificationStateData = {
  conversationId: string
  tenantId: string
  agentId: string
  schemaId?: string | null
}

export type UpdateQualificationStateData = {
  stage?: ConversationStage
  lastIntent?: LeadIntent
  fields?: QualificationFields
  schemaId?: string | null
}

export function emptyQualificationFields(): QualificationFields {
  return {}
}

export function mergeQualificationFields(
  current: QualificationFields,
  updates: QualificationFields,
): QualificationFields {
  const result = { ...current }
  for (const [key, val] of Object.entries(updates)) {
    if (val !== null && val !== undefined && val !== '') {
      result[key] = val
    }
  }
  return result
}
