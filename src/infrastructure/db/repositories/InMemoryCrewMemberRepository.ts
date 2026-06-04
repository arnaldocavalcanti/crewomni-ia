import { randomUUID } from 'crypto'
import type { CrewMember, CreateCrewMemberData } from '@/domains/crew/entities/CrewMember'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'

const store = new Map<string, CrewMember>()

export class InMemoryCrewMemberRepository implements ICrewMemberRepository {
  async create(data: CreateCrewMemberData): Promise<CrewMember> {
    const member: CrewMember = {
      id:         randomUUID(),
      tenantId:   data.tenantId,
      crewId:     data.crewId,
      agentId:    data.agentId,
      role:       data.role,
      order:      data.order,
      isRequired: data.isRequired ?? true,
      createdAt:  new Date(),
    }
    store.set(member.id, member)
    return member
  }

  async findById(id: string, tenantId: string): Promise<CrewMember | null> {
    const m = store.get(id)
    return m?.tenantId === tenantId ? m : null
  }

  async findByCrewAndAgent(crewId: string, agentId: string, tenantId: string): Promise<CrewMember | null> {
    return Array.from(store.values()).find(
      (m) => m.crewId === crewId && m.agentId === agentId && m.tenantId === tenantId,
    ) ?? null
  }

  async findAllByCrew(crewId: string, tenantId: string): Promise<CrewMember[]> {
    return Array.from(store.values())
      .filter((m) => m.crewId === crewId && m.tenantId === tenantId)
      .sort((a, b) => a.order - b.order)
  }

  async findDirector(crewId: string, tenantId: string): Promise<CrewMember | null> {
    return Array.from(store.values()).find(
      (m) => m.crewId === crewId && m.tenantId === tenantId && m.role === CrewMemberRole.DIRECTOR,
    ) ?? null
  }

  async countDirectors(crewId: string, tenantId: string): Promise<number> {
    return Array.from(store.values()).filter(
      (m) => m.crewId === crewId && m.tenantId === tenantId && m.role === CrewMemberRole.DIRECTOR,
    ).length
  }

  async countByCrew(crewId: string, tenantId: string): Promise<number> {
    return Array.from(store.values()).filter(
      (m) => m.crewId === crewId && m.tenantId === tenantId,
    ).length
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const m = store.get(id)
    if (m?.tenantId === tenantId) store.delete(id)
  }

  clear(): void { store.clear() }
}
