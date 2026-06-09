import type { ApplyLifecycleTransition } from './ApplyLifecycleTransition'

export type AcceptHumanHandoffInput = {
  tenantId: string
  conversationId: string
  operatorId: string
}

export type AcceptHumanHandoffOutput = {
  conversationId: string
  previousStatus: string
  currentStatus: string
  eventId: string
}

export class AcceptHumanHandoff {
  constructor(private applyTransition: ApplyLifecycleTransition) {}

  async execute(input: AcceptHumanHandoffInput): Promise<AcceptHumanHandoffOutput> {
    return this.applyTransition.execute({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      toStatus: 'HANDOFF_ACCEPTED',
      actor: 'OPERATOR',
      actorId: input.operatorId,
    })
  }
}
