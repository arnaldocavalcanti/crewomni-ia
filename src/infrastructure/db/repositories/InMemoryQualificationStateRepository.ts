import { randomUUID } from 'crypto'
import type {
  QualificationState,
  CreateQualificationStateData,
  UpdateQualificationStateData,
} from '@/domains/qualification/entities/QualificationState'
import {
  ConversationStage,
  emptyQualificationFields,
  mergeQualificationFields,
} from '@/domains/qualification/entities/QualificationState'
import type { IQualificationStateRepository } from '@/domains/qualification/repositories/IQualificationStateRepository'

const store = new Map<string, QualificationState>()

export class InMemoryQualificationStateRepository implements IQualificationStateRepository {
  async findByConversation(
    conversationId: string,
    tenantId: string,
  ): Promise<QualificationState | null> {
    return (
      Array.from(store.values()).find(
        (s) => s.conversationId === conversationId && s.tenantId === tenantId,
      ) ?? null
    )
  }

  async create(data: CreateQualificationStateData): Promise<QualificationState> {
    const state: QualificationState = {
      id: randomUUID(),
      conversationId: data.conversationId,
      tenantId: data.tenantId,
      agentId: data.agentId,
      stage: ConversationStage.QUALIFYING,
      lastIntent: null,
      fields: emptyQualificationFields(),
      updatedAt: new Date(),
    }
    store.set(state.id, state)
    return state
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateQualificationStateData,
  ): Promise<QualificationState> {
    const state = store.get(id)
    if (!state || state.tenantId !== tenantId) {
      throw new Error('QualificationState not found')
    }
    const updated: QualificationState = {
      ...state,
      ...(data.stage !== undefined ? { stage: data.stage } : {}),
      ...(data.lastIntent !== undefined ? { lastIntent: data.lastIntent } : {}),
      fields: data.fields ? mergeQualificationFields(state.fields, data.fields) : state.fields,
      updatedAt: new Date(),
    }
    store.set(id, updated)
    return updated
  }

  clear(): void {
    store.clear()
  }
}
