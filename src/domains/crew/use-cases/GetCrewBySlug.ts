import { AppError } from '@/shared/errors/AppError'
import type { Crew } from '../entities/Crew'
import type { CrewMember } from '../entities/CrewMember'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'

type GetCrewBySlugInput = {
  slug: string
  tenantId: string
}

type GetCrewBySlugOutput = Crew & { members: CrewMember[] }

export class GetCrewBySlug {
  constructor(
    private crewRepo: ICrewRepository,
    private memberRepo: ICrewMemberRepository,
  ) {}

  async execute(input: GetCrewBySlugInput): Promise<GetCrewBySlugOutput> {
    const { slug, tenantId } = input

    if (!slug) throw new AppError('VALIDATION_ERROR', 'O slug é obrigatório.')
    if (!tenantId) throw new AppError('VALIDATION_ERROR', 'O tenantId é obrigatório.')

    const crew = await this.crewRepo.findBySlug(slug, tenantId)

    if (!crew) {
      throw new AppError('CREW_NOT_FOUND', 'Crew não encontrada.')
    }

    const members = await this.memberRepo.findAllByCrew(crew.id, tenantId)
    const sortedMembers = members.sort((a, b) => a.order - b.order)

    return { ...crew, members: sortedMembers }
  }
}
