import { randomUUID } from 'crypto'
import type { Agent, AgentStatus, CreateAgentData, UpdateAgentData } from '@/domains/agent/entities/Agent'
import { AgentStatus as AS, AgentType } from '@/domains/agent/entities/Agent'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaAgentRepository implements IAgentRepository {
  private get db() { return getPrismaClient() }

  async findById(id: string, tenantId: string): Promise<Agent | null> {
    const r = await this.db.agent.findFirst({ where: { id, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findByName(name: string, tenantId: string): Promise<Agent | null> {
    const r = await this.db.agent.findFirst({ where: { name, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findBySlug(slug: string, tenantId: string): Promise<Agent | null> {
    const r = await this.db.agent.findFirst({ where: { slug, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async countActive(tenantId: string): Promise<number> {
    return this.db.agent.count({ where: { tenantId, status: 'ACTIVE' } })
  }

  async listByTenant(tenantId: string): Promise<Agent[]> {
    const records = await this.db.agent.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
    return records.map((r) => this.toEntity(r))
  }

  async create(data: CreateAgentData): Promise<Agent> {
    const r = await this.db.agent.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        name: data.name,
        slug: data.slug,
        type: data.type,
        category: data.category,
        roleId: data.roleId,
        operationalFunction: data.operationalFunction,
        description: data.description ?? null,
        status: AS.DRAFT,

        directorId: data.directorId ?? null,
        mainChannel: data.mainChannel ?? null,
        toneOfVoice: data.toneOfVoice ?? null,
        communicationStyle: data.communicationStyle ?? null,
        autonomyLevel: data.autonomyLevel ?? null,
        responsibilities: data.responsibilities ?? [],

        permissionReadKB: data.permissionReadKB ?? true,
        permissionSendWhatsapp: data.permissionSendWhatsapp ?? false,
        permissionSendEmail: data.permissionSendEmail ?? false,
        permissionExecuteTool: data.permissionExecuteTool ?? false,
        permissionCallHuman: data.permissionCallHuman ?? false,
        permissionCreateTask: data.permissionCreateTask ?? false,
        permissionReadHistory: data.permissionReadHistory ?? false,
        permissionReadCommercial: data.permissionReadCommercial ?? false,

        outputFormat: data.outputFormat ?? null,
        expectedExamples: data.expectedExamples ?? null,
        specificRules: data.specificRules ?? null,
      },
    })
    return this.toEntity(r)
  }

  async updateStatus(id: string, tenantId: string, status: AgentStatus): Promise<void> {
    await this.db.agent.updateMany({ where: { id, tenantId }, data: { status } })
  }

  async update(id: string, tenantId: string, data: UpdateAgentData): Promise<Agent> {
    const r = await this.db.agent.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.roleId !== undefined && { roleId: data.roleId }),
        ...(data.operationalFunction !== undefined && { operationalFunction: data.operationalFunction }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.directorId !== undefined && { directorId: data.directorId }),
        ...(data.mainChannel !== undefined && { mainChannel: data.mainChannel }),
        ...(data.toneOfVoice !== undefined && { toneOfVoice: data.toneOfVoice }),
        ...(data.communicationStyle !== undefined && { communicationStyle: data.communicationStyle }),
        ...(data.autonomyLevel !== undefined && { autonomyLevel: data.autonomyLevel }),
        ...(data.responsibilities !== undefined && { responsibilities: data.responsibilities }),
        ...(data.permissionReadKB !== undefined && { permissionReadKB: data.permissionReadKB }),
        ...(data.permissionSendWhatsapp !== undefined && { permissionSendWhatsapp: data.permissionSendWhatsapp }),
        ...(data.permissionSendEmail !== undefined && { permissionSendEmail: data.permissionSendEmail }),
        ...(data.permissionExecuteTool !== undefined && { permissionExecuteTool: data.permissionExecuteTool }),
        ...(data.permissionCallHuman !== undefined && { permissionCallHuman: data.permissionCallHuman }),
        ...(data.permissionCreateTask !== undefined && { permissionCreateTask: data.permissionCreateTask }),
        ...(data.permissionReadHistory !== undefined && { permissionReadHistory: data.permissionReadHistory }),
        ...(data.permissionReadCommercial !== undefined && { permissionReadCommercial: data.permissionReadCommercial }),
        ...(data.outputFormat !== undefined && { outputFormat: data.outputFormat }),
        ...(data.expectedExamples !== undefined && { expectedExamples: data.expectedExamples }),
        ...(data.specificRules !== undefined && { specificRules: data.specificRules }),
      },
    })
    return this.toEntity(r)
  }

  private toEntity(r: any): Agent {
    return {
      id: r.id,
      tenantId: r.tenantId,
      name: r.name,
      slug: r.slug,
      type: r.type as AgentType,
      category: r.category,
      roleId: r.roleId,
      operationalFunction: r.operationalFunction,
      description: r.description,
      status: r.status as AS,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,

      directorId: r.directorId,
      mainChannel: r.mainChannel,
      toneOfVoice: r.toneOfVoice,
      communicationStyle: r.communicationStyle,
      autonomyLevel: r.autonomyLevel,
      responsibilities: Array.isArray(r.responsibilities)
        ? (r.responsibilities as string[])
        : (typeof r.responsibilities === 'string' ? JSON.parse(r.responsibilities) : []),

      permissionReadKB: r.permissionReadKB,
      permissionSendWhatsapp: r.permissionSendWhatsapp,
      permissionSendEmail: r.permissionSendEmail,
      permissionExecuteTool: r.permissionExecuteTool,
      permissionCallHuman: r.permissionCallHuman,
      permissionCreateTask: r.permissionCreateTask,
      permissionReadHistory: r.permissionReadHistory,
      permissionReadCommercial: r.permissionReadCommercial,

      outputFormat: r.outputFormat,
      expectedExamples: r.expectedExamples,
      specificRules: r.specificRules,
    }
  }
}
