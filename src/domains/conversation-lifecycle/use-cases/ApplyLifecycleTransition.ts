import { realtimeService } from '@/infrastructure/realtime/RealtimeService'
import { AppError } from '@/shared/errors/AppError'
import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import type { IConversationLifecycleRepository } from '../repositories/IConversationLifecycleRepository'
import {
  isValidTransition,
  type ConversationStatus,
  type LifecycleActor,
} from '../entities/ConversationLifecycleEvent'

type Input = {
  tenantId: string
  conversationId: string
  toStatus: ConversationStatus
  actor: LifecycleActor
  actorId?: string
  reason?: string
}

type Output = {
  conversationId: string
  previousStatus: ConversationStatus
  currentStatus: ConversationStatus
  eventId: string
}

export class ApplyLifecycleTransition {
  constructor(
    private conversationRepo: IConversationRepository,
    private lifecycleRepo: IConversationLifecycleRepository,
  ) {}

  async execute(input: Input): Promise<Output> {
    const { tenantId, conversationId, toStatus, actor, actorId, reason } = input

    const conversation = await this.conversationRepo.findConversationById({
      id: conversationId,
      tenantId,
    })
    if (!conversation) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada')
    }

    // O status no banco pode estar mapeado para OPEN. Se for OPEN, consideramos ACTIVE para o ciclo de vida.
    let fromStatus = conversation.status as ConversationStatus
    if ((fromStatus as string) === 'OPEN') {
      fromStatus = 'ACTIVE'
    }

    if (!isValidTransition(fromStatus, toStatus)) {
      throw new AppError(
        'INVALID_LIFECYCLE_TRANSITION',
        `Transição inválida de ${fromStatus} para ${toStatus}`
      )
    }

    if (toStatus === 'HANDOFF_REQUESTED' && !reason) {
      throw new AppError('HANDOFF_REASON_REQUIRED', 'Motivo do handoff é obrigatório')
    }

    if (toStatus === 'HANDOFF_ACCEPTED' && !actorId) {
      throw new AppError('OPERATOR_ID_REQUIRED', 'ID do operador é obrigatório para aceitar handoff')
    }

    // Persiste evento de lifecycle (append-only)
    const eventId = crypto.randomUUID()
    await this.lifecycleRepo.save({
      id: eventId,
      tenantId,
      conversationId,
      fromStatus,
      toStatus,
      actor,
      actorId,
      reason,
      createdAt: new Date(),
    })

    // Atualiza status da conversa
    await this.conversationRepo.updateConversationStatus(conversationId, toStatus, tenantId)

    // Publica o evento para atualizar os clientes (Dashboard/Widgets)
    realtimeService.publishEvent(tenantId, 'LIFECYCLE_CHANGED', {
      conversationId,
      previousStatus: fromStatus,
      currentStatus: toStatus,
      eventId,
    })

    return { conversationId, previousStatus: fromStatus, currentStatus: toStatus, eventId }
  }
}
