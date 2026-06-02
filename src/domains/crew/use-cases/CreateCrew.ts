import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { Crew } from '../entities/Crew'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import { generateSlug } from '@/domains/organization/utils/generateSlug'

type Input = {
  tenantId:     string
  departmentId: string
  name:         string
  description?: string
  objective?:   string
}

export class CreateCrew {
  constructor(
    private crewRepo: ICrewRepository,
    private deptRepo: IDepartmentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<Crew> {
    const dept = await this.deptRepo.findById(input.departmentId, input.tenantId)
    if (!dept) throw new AppError('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado')

    const existing = await this.crewRepo.findByName(input.name, input.tenantId)
    if (existing) throw new AppError('CREW_NAME_TAKEN', 'Já existe uma crew com este nome')

    const slug = generateSlug(input.name)

    const crew = await this.crewRepo.create({
      tenantId:     input.tenantId,
      departmentId: input.departmentId,
      name:         input.name,
      slug,
      description:  input.description,
      objective:    input.objective,
    })

    await this.auditLogger.log({
      action: 'crew.created', tenantId: input.tenantId,
      resourceId: crew.id, resourceType: 'crew',
      metadata: { name: crew.name, departmentId: crew.departmentId },
    })

    return crew
  }
}
