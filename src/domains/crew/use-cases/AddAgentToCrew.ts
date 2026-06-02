import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { CrewMember, CrewMemberRole } from '../entities/CrewMember'
import { CrewMemberRole as Role } from '../entities/CrewMember'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'

type Input = {
  tenantId:    string
  crewId:      string
  agentId:     string
  role:        CrewMemberRole
  order:       number
  isRequired?: boolean
}

export class AddAgentToCrew {
  constructor(
    private crewRepo:   ICrewRepository,
    private memberRepo: ICrewMemberRepository,
    private agentRepo:  IAgentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<CrewMember> {
    const [crew, agent] = await Promise.all([
      this.crewRepo.findById(input.crewId, input.tenantId),
      this.agentRepo.findById(input.agentId, input.tenantId),
    ])

    if (!crew)  throw new AppError('CREW_NOT_FOUND',  'Crew não encontrada')
    if (!agent) throw new AppError('AGENT_NOT_FOUND', 'Agente não encontrado')

    const duplicate = await this.memberRepo.findByCrewAndAgent(input.crewId, input.agentId, input.tenantId)
    if (duplicate) throw new AppError('AGENT_ALREADY_IN_CREW', 'Este agente já está nesta crew')

    if (input.role === Role.DIRECTOR) {
      const directorCount = await this.memberRepo.countDirectors(input.crewId, input.tenantId)
      if (directorCount > 0) throw new AppError('CREW_ALREADY_HAS_DIRECTOR', 'Esta crew já possui um director')
    }

    const member = await this.memberRepo.create({
      tenantId:   input.tenantId,
      crewId:     input.crewId,
      agentId:    input.agentId,
      role:       input.role,
      order:      input.order,
      isRequired: input.isRequired,
    })

    await this.auditLogger.log({
      action: 'crew.member_added', tenantId: input.tenantId,
      resourceId: member.id, resourceType: 'crew_member',
      metadata: { crewId: input.crewId, agentId: input.agentId, role: input.role },
    })

    return member
  }
}
