import { AppError } from '@/shared/errors/AppError'
import type { CrewMember } from '../entities/CrewMember'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'

export class ListCrewMembers {
  constructor(
    private crewRepo:   ICrewRepository,
    private memberRepo: ICrewMemberRepository,
  ) {}

  async execute(input: { crewId: string; tenantId: string }): Promise<CrewMember[]> {
    const crew = await this.crewRepo.findById(input.crewId, input.tenantId)
    if (!crew) throw new AppError('CREW_NOT_FOUND', 'Crew não encontrada')
    return this.memberRepo.findAllByCrew(input.crewId, input.tenantId)
  }
}
