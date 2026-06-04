import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'

export class RemoveAgentFromCrew {
  constructor(
    private memberRepo: ICrewMemberRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: { memberId: string; tenantId: string }): Promise<void> {
    const member = await this.memberRepo.findById(input.memberId, input.tenantId)
    if (!member) throw new AppError('CREW_MEMBER_NOT_FOUND', 'Membro não encontrado')

    await this.memberRepo.delete(input.memberId, input.tenantId)

    await this.auditLogger.log({
      action: 'crew.member_removed', tenantId: input.tenantId,
      resourceId: input.memberId, resourceType: 'crew_member',
      metadata: { crewId: member.crewId, agentId: member.agentId },
    })
  }
}
