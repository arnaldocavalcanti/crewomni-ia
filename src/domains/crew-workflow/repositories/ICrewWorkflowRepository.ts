import type { CrewWorkflow, CreateCrewWorkflowData } from '../entities/CrewWorkflow'

export interface ICrewWorkflowRepository {
  findByCrewId(params: { crewId: string; tenantId: string }): Promise<CrewWorkflow | null>
  save(data: CreateCrewWorkflowData): Promise<CrewWorkflow>
  delete(params: { crewId: string; tenantId: string }): Promise<void>
}
