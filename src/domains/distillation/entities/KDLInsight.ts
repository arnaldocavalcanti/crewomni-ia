import { Niche } from '@/domains/tenant/entities/Tenant'

export enum KDLInsightStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type KDLInsight = {
  id: string
  niche: Niche
  questionPattern: string
  answerPattern: string
  sourceCount: number
  confidence: number
  status: KDLInsightStatus
  reviewedBy?: string | null
  reviewedAt?: Date | null
  createdAt: Date
}
