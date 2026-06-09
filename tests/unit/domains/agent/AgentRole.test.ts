import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateAgentRole } from '@/domains/agent/use-cases/CreateAgentRole'
import { ListAgentRoles } from '@/domains/agent/use-cases/ListAgentRoles'
import type { IAgentRoleRepository } from '@/domains/agent/repositories/IAgentRoleRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { UserRole } from '@/domains/auth/entities/User'

const mockRole = {
  id: 'role-1',
  tenantId: 'tenant-1',
  name: 'Custom SDR',
  category: 'Comercial',
  description: 'Custom SDR role',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockGlobalRole = {
  id: 'global-role',
  tenantId: null,
  name: 'SDR',
  category: 'Comercial',
  description: 'Global SDR role',
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeRepos() {
  const roleRepo: IAgentRoleRepository = {
    findById: vi.fn(),
    findByName: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([mockGlobalRole, mockRole]),
    create: vi.fn().mockResolvedValue(mockRole),
  }
  const auditLogger: IAuditLogger = { log: vi.fn() }
  return { roleRepo, auditLogger }
}

describe('AgentRole Use Cases', () => {
  let roleRepo: IAgentRoleRepository
  let auditLogger: IAuditLogger

  beforeEach(() => {
    const repos = makeRepos()
    roleRepo = repos.roleRepo
    auditLogger = repos.auditLogger
  })

  describe('CreateAgentRole', () => {
    let useCase: CreateAgentRole

    beforeEach(() => {
      useCase = new CreateAgentRole(roleRepo, auditLogger)
    })

    it('deve criar papel personalizado com sucesso', async () => {
      const result = await useCase.execute({
        tenantId: 'tenant-1',
        name: 'Custom SDR',
        category: 'Comercial',
        description: 'Custom SDR role',
        requestedByRole: UserRole.TENANT_ADMIN,
      })

      expect(result).toBeDefined()
      expect(result.name).toBe('Custom SDR')
      expect(roleRepo.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        name: 'Custom SDR',
        category: 'Comercial',
        description: 'Custom SDR role',
      })
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'agent_role.created', tenantId: 'tenant-1' })
      )
    })

    it('deve rejeitar se o nome for vazio', async () => {
      await expect(
        useCase.execute({
          tenantId: 'tenant-1',
          name: '',
          category: 'Comercial',
          requestedByRole: UserRole.TENANT_ADMIN,
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    })

    it('deve rejeitar se a categoria for vazia', async () => {
      await expect(
        useCase.execute({
          tenantId: 'tenant-1',
          name: 'SDR',
          category: '',
          requestedByRole: UserRole.TENANT_ADMIN,
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    })

    it('deve rejeitar se o nome for duplicado no mesmo tenant', async () => {
      vi.mocked(roleRepo.findByName).mockImplementation(async (name, tenantId) => {
        if (tenantId === 'tenant-1') return mockRole
        return null
      })

      await expect(
        useCase.execute({
          tenantId: 'tenant-1',
          name: 'Custom SDR',
          category: 'Comercial',
          requestedByRole: UserRole.TENANT_ADMIN,
        })
      ).rejects.toMatchObject({ code: 'ROLE_NAME_DUPLICATED' })
    })

    it('deve rejeitar se o nome for duplicado de um papel global', async () => {
      vi.mocked(roleRepo.findByName).mockImplementation(async (name, tenantId) => {
        if (tenantId === null) return mockGlobalRole
        return null
      })

      await expect(
        useCase.execute({
          tenantId: 'tenant-1',
          name: 'SDR',
          category: 'Comercial',
          requestedByRole: UserRole.TENANT_ADMIN,
        })
      ).rejects.toMatchObject({ code: 'ROLE_NAME_DUPLICATED' })
    })

    it('deve lançar erro se o usuário não for admin ou operador', async () => {
      await expect(
        useCase.execute({
          tenantId: 'tenant-1',
          name: 'SDR',
          category: 'Comercial',
          requestedByRole: UserRole.KDL_APPROVER,
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('ListAgentRoles', () => {
    let useCase: ListAgentRoles

    beforeEach(() => {
      useCase = new ListAgentRoles(roleRepo)
    })

    it('deve listar papéis globais e locais', async () => {
      const result = await useCase.execute({ tenantId: 'tenant-1' })
      expect(result).toHaveLength(2)
      expect(result[0].tenantId).toBeNull()
      expect(result[1].tenantId).toBe('tenant-1')
      expect(roleRepo.list).toHaveBeenCalledWith('tenant-1')
    })
  })
})
