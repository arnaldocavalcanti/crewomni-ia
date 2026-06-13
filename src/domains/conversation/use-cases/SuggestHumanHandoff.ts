import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'

type SuggestHumanHandoffInput = {
  tenantId: string
  crewId: string
  reason: string
}

type SuggestHumanHandoffOutput = {
  canSuggest: boolean
  crewName: string
  reason: string
}

export class SuggestHumanHandoff {
  constructor(private crewRepo: ICrewRepository) {}

  async execute(input: SuggestHumanHandoffInput): Promise<SuggestHumanHandoffOutput> {
    const crew = await this.crewRepo.findById(input.crewId, input.tenantId)
    if (!crew?.humanHandoffWhatsappNumber) {
      return { canSuggest: false, crewName: crew?.name ?? '', reason: input.reason }
    }
    return { canSuggest: true, crewName: crew.name, reason: input.reason }
  }
}
