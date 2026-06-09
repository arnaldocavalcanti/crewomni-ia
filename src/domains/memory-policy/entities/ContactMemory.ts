export type ContactMemoryStatus = 'CANDIDATE' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'EXPIRED'
export type ContactMemoryType = 'FACT' | 'PREFERENCE' | 'QUALIFICATION' | 'CONTEXT'

export type ContactMemory = {
  id: string
  tenantId: string
  contactId: string
  memoryType: ContactMemoryType
  content: string
  sourceConversationId: string
  confidence: number
  status: ContactMemoryStatus
  shouldPersist: boolean
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}
