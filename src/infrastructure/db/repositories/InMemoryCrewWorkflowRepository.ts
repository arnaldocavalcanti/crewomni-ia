import type { CrewWorkflow, CreateCrewWorkflowData } from '@/domains/crew-workflow/entities/CrewWorkflow'
import type { ICrewWorkflowRepository } from '@/domains/crew-workflow/repositories/ICrewWorkflowRepository'

export class InMemoryCrewWorkflowRepository implements ICrewWorkflowRepository {
  private store = new Map<string, CrewWorkflow>()

  async findByCrewId({ crewId, tenantId }: { crewId: string; tenantId: string }): Promise<CrewWorkflow | null> {
    const data = this.store.get(crewId)
    if (!data || data.tenantId !== tenantId) {
      return null
    }
    return data
  }

  async save(data: CreateCrewWorkflowData): Promise<CrewWorkflow> {
    const id = this.store.get(data.crewId)?.id ?? crypto.randomUUID()
    const now = new Date()
    
    const workflow: CrewWorkflow = {
      ...data,
      id,
      createdAt: this.store.get(data.crewId)?.createdAt ?? now,
      updatedAt: now,
    }

    this.store.set(data.crewId, workflow)
    return workflow
  }

  async delete({ crewId, tenantId }: { crewId: string; tenantId: string }): Promise<void> {
    const data = this.store.get(crewId)
    if (data && data.tenantId === tenantId) {
      this.store.delete(crewId)
    }
  }

  clear() {
    this.store.clear()
  }
}
