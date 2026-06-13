import type { HumanHandoff } from '../entities/HumanHandoff'

export interface IHumanHandoffRepository {
  save(handoff: HumanHandoff): Promise<void>
  findByConversationId(conversationId: string, tenantId: string): Promise<HumanHandoff | null>
}
