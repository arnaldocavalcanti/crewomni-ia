import type { IConversationRepository } from '../repositories/IConversationRepository'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { AppError } from '@/shared/errors/AppError'
import type { Conversation } from '../entities/Conversation'
import type { ApplyLifecycleTransition } from '@/domains/conversation-lifecycle/use-cases/ApplyLifecycleTransition'

export type TransferConversationInput = {
  tenantId: string
  conversationId: string
  targetAgentId: string
}

export class TransferConversation {
  constructor(
    private conversationRepo: IConversationRepository,
    private crewMemberRepo: ICrewMemberRepository,
    private auditLogger: IAuditLogger,
    private applyLifecycleTransition: ApplyLifecycleTransition,
  ) {}

  async execute(input: TransferConversationInput): Promise<Conversation> {
    const { tenantId, conversationId, targetAgentId } = input

    const conversation = await this.conversationRepo.findConversationById({
      id: conversationId,
      tenantId,
    })

    if (!conversation) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.')
    }

    if (!conversation.crewId) {
      throw new AppError('HANDOFF_NOT_ALLOWED', 'Apenas conversas de uma Equipe (Crew) podem ser transferidas.')
    }

    if (conversation.agentId === targetAgentId) {
      return conversation
    }

    const member = await this.crewMemberRepo.findByCrewAndAgent(conversation.crewId, targetAgentId, tenantId)
    if (!member) {
      throw new AppError('AGENT_NOT_IN_CREW', 'O agente de destino não pertence a esta equipe.')
    }

    const oldAgentId = conversation.agentId
    await this.conversationRepo.updateConversationAgent(conversationId, targetAgentId, tenantId)
    conversation.agentId = targetAgentId

    // Salva o lifecycle event usando o caso de uso oficial de transição de ciclo de vida
    await this.applyLifecycleTransition.execute({
      tenantId,
      conversationId,
      toStatus: 'ACTIVE',
      actor: 'SYSTEM',
      reason: `TRANSFER:${oldAgentId}:${targetAgentId}`, // Serializa no campo reason para não precisar de migração no banco!
    })

    await this.auditLogger.log({
      tenantId,
      action: 'CONVERSATION_TRANSFERRED',
      resourceType: 'Conversation',
      resourceId: conversationId,
      metadata: {
        crewId: conversation.crewId,
        fromAgentId: oldAgentId,
        toAgentId: targetAgentId,
      },
    })

    return conversation
  }
}

