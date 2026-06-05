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

export type QualificationFields = {
  tipo_empresa: string | null
  numero_colaboradores: string | null
  usa_crm: string | null
  nome_contato: string | null
  telefone: string | null
  email: string | null
  nivel_interesse: string | null
  objecao: string | null
}

export type QualificationState = {
  id: string
  conversationId: string
  tenantId: string
  agentId: string
  stage: ConversationStage
  lastIntent: LeadIntent | null
  fields: QualificationFields
  updatedAt: Date
}

export type CreateQualificationStateData = {
  conversationId: string
  tenantId: string
  agentId: string
}

export type UpdateQualificationStateData = {
  stage?: ConversationStage
  lastIntent?: LeadIntent
  fields?: Partial<QualificationFields>
}
