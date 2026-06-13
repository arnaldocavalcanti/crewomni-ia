import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { Crew, CrewStatus, UpdateCrewData } from '../entities/Crew'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import { generateSlug } from '@/domains/organization/utils/generateSlug'

type Input = {
  id:           string
  tenantId:     string
  name?:        string
  description?: string
  objective?:   string
  status?:      CrewStatus
  humanHandoffWhatsappNumber?: string | null
  humanHandoffWebhookUrl?:     string | null
}

export class UpdateCrew {
  constructor(
    private repo: ICrewRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<Crew> {
    const existing = await this.repo.findById(input.id, input.tenantId)
    if (!existing) throw new AppError('CREW_NOT_FOUND', 'Crew não encontrada')

    const updateData: UpdateCrewData = {}

    if (input.name !== undefined) {
      const byName = await this.repo.findByName(input.name, input.tenantId)
      if (byName && byName.id !== input.id) throw new AppError('CREW_NAME_TAKEN', 'Já existe uma crew com este nome')
      updateData.name = input.name
      updateData.slug = generateSlug(input.name)
    }

    if (input.description !== undefined) updateData.description = input.description
    if (input.objective   !== undefined) updateData.objective   = input.objective
    if (input.status      !== undefined) updateData.status      = input.status
    if (input.humanHandoffWhatsappNumber !== undefined) updateData.humanHandoffWhatsappNumber = input.humanHandoffWhatsappNumber
    if (input.humanHandoffWebhookUrl !== undefined) updateData.humanHandoffWebhookUrl = input.humanHandoffWebhookUrl

    const updated = await this.repo.update(input.id, input.tenantId, updateData)

    await this.auditLogger.log({
      action: 'crew.updated', tenantId: input.tenantId,
      resourceId: input.id, resourceType: 'crew',
      metadata: updateData as Record<string, unknown>,
    })

    return updated
  }
}
