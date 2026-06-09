import { PrismaClient } from '@prisma/client'
import type { CrewWorkflow, CreateCrewWorkflowData } from '@/domains/crew-workflow/entities/CrewWorkflow'
import type { ICrewWorkflowRepository } from '@/domains/crew-workflow/repositories/ICrewWorkflowRepository'

export class PrismaCrewWorkflowRepository implements ICrewWorkflowRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByCrewId({ crewId, tenantId }: { crewId: string; tenantId: string }): Promise<CrewWorkflow | null> {
    const data = await (this.prisma as any).crewWorkflow.findUnique({
      where: {
        crewId,
      },
    })

    if (!data || data.tenantId !== tenantId) {
      return null
    }

    return {
      id: data.id,
      tenantId: data.tenantId,
      crewId: data.crewId,
      nodes: data.nodes as any,
      edges: data.edges as any,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  async save(data: CreateCrewWorkflowData): Promise<CrewWorkflow> {
    const saved = await (this.prisma as any).crewWorkflow.upsert({
      where: {
        crewId: data.crewId,
      },
      create: {
        tenantId: data.tenantId,
        crewId: data.crewId,
        nodes: data.nodes as any,
        edges: data.edges as any,
      },
      update: {
        nodes: data.nodes as any,
        edges: data.edges as any,
      },
    })

    return {
      id: saved.id,
      tenantId: saved.tenantId,
      crewId: saved.crewId,
      nodes: saved.nodes as any,
      edges: saved.edges as any,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    }
  }

  async delete({ crewId, tenantId }: { crewId: string; tenantId: string }): Promise<void> {
    await (this.prisma as any).crewWorkflow.deleteMany({
      where: {
        crewId,
        tenantId,
      },
    })
  }
}
