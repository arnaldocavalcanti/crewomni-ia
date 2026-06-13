export type HumanHandoff = {
  id: string
  tenantId: string
  conversationId: string
  reason: string
  contactPhone: string | null
  webhookSent: boolean
  waSentAt: Date | null
  webhookSentAt: Date | null
  createdAt: Date
}
