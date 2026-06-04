import type { CrewMember, CreateCrewMemberData } from '../entities/CrewMember'

export interface ICrewMemberRepository {
  create(data: CreateCrewMemberData): Promise<CrewMember>
  findById(id: string, tenantId: string): Promise<CrewMember | null>
  findByCrewAndAgent(crewId: string, agentId: string, tenantId: string): Promise<CrewMember | null>
  findAllByCrew(crewId: string, tenantId: string): Promise<CrewMember[]>
  findDirector(crewId: string, tenantId: string): Promise<CrewMember | null>
  countDirectors(crewId: string, tenantId: string): Promise<number>
  countByCrew(crewId: string, tenantId: string): Promise<number>
  delete(id: string, tenantId: string): Promise<void>
}
