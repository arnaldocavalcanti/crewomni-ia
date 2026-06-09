import type { ApplyLifecycleTransition } from './ApplyLifecycleTransition'

export type RequestHumanHandoffInput = {
  tenantId: string
  conversationId: string
  reason: string
  triggeredBy: 'AGENT' | 'OPERATOR' | 'USER'
  triggeredById?: string
  confidence?: number
}

export type RequestHumanHandoffOutput = {
  conversationId: string
  previousStatus: string
  currentStatus: string
  eventId: string
}

export class RequestHumanHandoff {
  constructor(private applyTransition: ApplyLifecycleTransition) {}

  async execute(input: RequestHumanHandoffInput): Promise<RequestHumanHandoffOutput> {
    return this.applyTransition.execute({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      toStatus: 'HANDOFF_REQUESTED',
      actor: input.triggeredBy,
      actorId: input.triggeredById,
      reason: input.reason,
    })
  }
}
