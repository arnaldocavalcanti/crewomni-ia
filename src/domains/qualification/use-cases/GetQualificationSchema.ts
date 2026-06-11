import { AppError } from '@/shared/errors/AppError'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { IQualificationSchemaRepository } from '../repositories/IQualificationSchemaRepository'
import type { QualificationSchema } from '../entities/QualificationSchema'

const GENERIC_NICHE_KEY = 'generic'

export type GetQualificationSchemaInput = {
  agentId: string
  tenantId: string
}

export class GetQualificationSchema {
  constructor(
    private agentRepo: IAgentRepository,
    private schemaRepo: IQualificationSchemaRepository,
  ) {}

  async execute(input: GetQualificationSchemaInput): Promise<QualificationSchema> {
    const agent = await this.agentRepo.findById(input.agentId, input.tenantId)
    if (!agent) throw new AppError('AGENT_NOT_FOUND', 'Agente não encontrado.')

    // 1. Schema configurado no agente
    const agentSchemaId = (agent as any).qualificationSchemaId as string | null | undefined
    if (agentSchemaId) {
      const schema = await this.schemaRepo.findById(agentSchemaId)
      if (schema && (schema.tenantId === input.tenantId || schema.tenantId === null)) {
        return schema
      }
    }

    // 2. Fallback: schema global genérico
    const globalSchema = await this.schemaRepo.findGlobalByNicheKey(GENERIC_NICHE_KEY)
    if (globalSchema) return globalSchema

    throw new AppError('QUALIFICATION_SCHEMA_NOT_FOUND', 'Nenhum schema de qualificação encontrado para este agente.')
  }
}
