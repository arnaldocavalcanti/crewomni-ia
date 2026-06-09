export type ConversationStatus =
  | 'ACTIVE'
  | 'WAITING_USER'
  | 'WAITING_AGENT'
  | 'HANDOFF_REQUESTED'
  | 'HANDOFF_ACCEPTED'
  | 'CLOSED'
  | 'REOPENED'
  | 'ARCHIVED'

export type LifecycleActor = 'AGENT' | 'USER' | 'OPERATOR' | 'SYSTEM'

export type ConversationLifecycleEvent = {
  id: string
  tenantId: string
  conversationId: string
  fromStatus: ConversationStatus
  toStatus: ConversationStatus
  actor: LifecycleActor
  actorId?: string
  reason?: string
  createdAt: Date
}

export const VALID_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  ACTIVE: ['WAITING_USER', 'WAITING_AGENT', 'HANDOFF_REQUESTED', 'CLOSED'],
  WAITING_USER: ['ACTIVE', 'CLOSED'],
  WAITING_AGENT: ['ACTIVE', 'CLOSED'],
  HANDOFF_REQUESTED: ['HANDOFF_ACCEPTED', 'ACTIVE'],
  HANDOFF_ACCEPTED: ['ACTIVE', 'CLOSED'],
  CLOSED: ['REOPENED', 'ARCHIVED'],
  REOPENED: ['ACTIVE'],
  ARCHIVED: [],
}

export function canAgentProcess(status: ConversationStatus): boolean {
  return ['ACTIVE', 'WAITING_USER', 'REOPENED'].includes(status)
}

export function isValidTransition(from: ConversationStatus, to: ConversationStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
