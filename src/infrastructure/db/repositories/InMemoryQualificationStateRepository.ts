import { randomUUID } from 'crypto'
import type {
  QualificationState,
  QualificationFields,
  CreateQualificationStateData,
  UpdateQualificationStateData,
} from '@/domains/qualification/entities/QualificationState'
import { ConversationStage } from '@/domains/qualification/entities/QualificationState'
import type { IQualificationStateRepository } from '@/domains/qualification/repositories/IQualificationStateRepository'

const store = new Map<string, QualificationState>()

function emptyFields(): QualificationFields {
  return {
    tipo_empresa: null,
    numero_colaboradores: null,
    usa_crm: null,
    nome_contato: null,
    telefone: null,
    email: null,
    nivel_interesse: null,
    objecao: null,
  }
}

function mergeFields(
  current: QualificationFields,
  updates: Partial<QualificationFields>,
): QualificationFields {
  const result = { ...current }
  for (const key of Object.keys(updates) as (keyof QualificationFields)[]) {
    const val = updates[key]
    if (val !== null && val !== undefined && val !== '') {
      result[key] = val
    }
  }
  return result
}

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
      fields: emptyFields(),
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
      fields: data.fields ? mergeFields(state.fields, data.fields) : state.fields,
      updatedAt: new Date(),
    }
    store.set(id, updated)
    return updated
  }

  clear(): void {
    store.clear()
  }
}
