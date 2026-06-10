import { describe, it, expect, vi } from 'vitest'
import { SimulateCrewMessage } from '@/domains/crew/use-cases/SimulateCrewMessage'
import { AppError } from '@/shared/errors/AppError'

describe('SimulateCrewMessage — integration edge cases', () => {
  it('propagates SendMessage error for empty message', async () => {
    const crewRepo = { findById: vi.fn().mockResolvedValue({ id: 'c1', tenantId: 't1', name: 'X', status: 'ACTIVE' }) }
    const crewMemberRepo = { findAllByCrew: vi.fn().mockResolvedValue([{ agentId: 'a1', role: 'DIRECTOR', order: 1 }]) }
    const agentRepo = { findById: vi.fn().mockResolvedValue({ id: 'a1', name: 'SDR', type: 'SDR', status: 'ACTIVE' }) }
    const sendMessage = {
      execute: vi.fn().mockRejectedValue(new AppError('VALIDATION_ERROR', 'A mensagem não pode ser vazia.')),
    }
    const lifecycleRepo = { findByConversationId: vi.fn().mockResolvedValue([]) }
    const channelConfigRepo = { findByTenantId: vi.fn().mockResolvedValue([]) }

    const uc = new SimulateCrewMessage(
      crewRepo as any, crewMemberRepo as any, agentRepo as any,
      sendMessage as any, lifecycleRepo as any, channelConfigRepo as any
    )

    await expect(
      uc.execute({ tenantId: 't1', crewId: 'c1', message: '', mode: 'SIMULATE' })
    ).rejects.toThrow('A mensagem não pode ser vazia.')
  })

  it('does not expose crew of another tenant', async () => {
    const crewRepo = { findById: vi.fn().mockResolvedValue(null) }
    const crewMemberRepo = { findAllByCrew: vi.fn() }
    const agentRepo = { findById: vi.fn() }
    const sendMessage = { execute: vi.fn() }
    const lifecycleRepo = { findByConversationId: vi.fn() }
    const channelConfigRepo = { findByTenantId: vi.fn() }

    const uc = new SimulateCrewMessage(
      crewRepo as any, crewMemberRepo as any, agentRepo as any,
      sendMessage as any, lifecycleRepo as any, channelConfigRepo as any
    )

    await expect(
      uc.execute({ tenantId: 'other-tenant', crewId: 'crew-belongs-to-tenant-1', message: 'hi', mode: 'SIMULATE' })
    ).rejects.toThrow(new AppError('CREW_NOT_FOUND', 'Crew não encontrada'))
  })
})
