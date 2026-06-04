import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'

export class DeleteCrew {
  constructor(
    private crewRepo:   ICrewRepository,
    private memberRepo: ICrewMemberRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: { id: string; tenantId: string }): Promise<void> {
    const crew = await this.crewRepo.findById(input.id, input.tenantId)
    if (!crew) throw new AppError('CREW_NOT_FOUND', 'Crew não encontrada')

    const memberCount = await this.memberRepo.countByCrew(input.id, input.tenantId)
    if (memberCount > 0) throw new AppError('CREW_HAS_MEMBERS', 'Não é possível deletar uma crew com membros')

    await this.crewRepo.delete(input.id, input.tenantId)

    await this.auditLogger.log({
      action: 'crew.deleted', tenantId: input.tenantId,
      resourceId: input.id, resourceType: 'crew',
      metadata: { name: crew.name },
    })
  }
}
