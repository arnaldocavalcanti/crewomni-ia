// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import { AppError } from '@/shared/errors/AppError'
import type {
  QualificationState,
  QualificationFields,
  CreateQualificationStateData,
  UpdateQualificationStateData,
} from '@/domains/qualification/entities/QualificationState'
import {
  ConversationStage,
  LeadIntent,
  emptyQualificationFields,
  mergeQualificationFields,
} from '@/domains/qualification/entities/QualificationState'
import type { IQualificationStateRepository } from '@/domains/qualification/repositories/IQualificationStateRepository'

export class PrismaQualificationStateRepository implements IQualificationStateRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any { return getPrismaClient() }

  async findByConversation(
    conversationId: string,
    tenantId: string,
  ): Promise<QualificationState | null> {
    const r = await this.db.qualificationState.findFirst({
      where: { conversationId, tenantId },
    })
    return r ? this.toEntity(r) : null
  }

  async create(data: CreateQualificationStateData): Promise<QualificationState> {
    const r = await this.db.qualificationState.create({
      data: {
        conversationId: data.conversationId,
        tenantId: data.tenantId,
        agentId: data.agentId,
        stage: ConversationStage.QUALIFYING,
        lastIntent: null,
        fields: emptyQualificationFields(),
      },
    })
    return this.toEntity(r)
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateQualificationStateData,
  ): Promise<QualificationState> {
    const existing = await this.db.qualificationState.findFirst({ where: { id, tenantId } })
    if (!existing) {
      throw new AppError('QUALIFICATION_STATE_NOT_FOUND', 'Estado de qualificação não encontrado.')
    }
    const currentFields = existing.fields as QualificationFields
    const mergedFields = data.fields
      ? mergeQualificationFields(currentFields, data.fields)
      : currentFields

    const r = await this.db.qualificationState.update({
      where: { id },
      data: {
        ...(data.stage !== undefined ? { stage: data.stage } : {}),
        ...(data.lastIntent !== undefined ? { lastIntent: data.lastIntent ?? null } : {}),
        fields: mergedFields,
      },
    })
    return this.toEntity(r)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toEntity(r: any): QualificationState {
    return {
      id: r.id,
      conversationId: r.conversationId,
      tenantId: r.tenantId,
      agentId: r.agentId,
      stage: r.stage as ConversationStage,
      lastIntent: r.lastIntent as LeadIntent | null,
      fields: r.fields as QualificationFields,
      updatedAt: r.updatedAt,
    }
  }
}
