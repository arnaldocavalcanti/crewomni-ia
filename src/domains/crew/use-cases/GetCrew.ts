import { AppError } from '@/shared/errors/AppError'
import type { Crew } from '../entities/Crew'
import type { CrewMember } from '../entities/CrewMember'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'

type Output = { crew: Crew; members: CrewMember[] }

export class GetCrew {
  constructor(
    private crewRepo: ICrewRepository,
    private memberRepo: ICrewMemberRepository,
  ) {}

  async execute(input: { id: string; tenantId: string }): Promise<Output> {
    const crew = await this.crewRepo.findById(input.id, input.tenantId)
    if (!crew) throw new AppError('CREW_NOT_FOUND', 'Crew não encontrada')
    const members = await this.memberRepo.findAllByCrew(input.id, input.tenantId)
    return { crew, members }
  }
}
