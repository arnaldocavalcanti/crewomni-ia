import type {
  QualificationState,
  CreateQualificationStateData,
  UpdateQualificationStateData,
} from '../entities/QualificationState'

export interface IQualificationStateRepository {
  findByConversation(conversationId: string, tenantId: string): Promise<QualificationState | null>
  create(data: CreateQualificationStateData): Promise<QualificationState>
  update(id: string, tenantId: string, data: UpdateQualificationStateData): Promise<QualificationState>
}
