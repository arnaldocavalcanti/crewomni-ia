import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { UserRole } from '@/domains/auth/entities/User'
import type { IAgentRoleRepository } from '../repositories/IAgentRoleRepository'
import type { AgentRole } from '../entities/AgentRole'

const ALLOWED_ROLES = [UserRole.TENANT_ADMIN, UserRole.TENANT_OPERATOR]

type CreateAgentRoleInput = {
  tenantId: string
  name: string
  category: string
  description?: string
  requestedByRole: UserRole
}

export class CreateAgentRole {
  constructor(
    private roleRepo: IAgentRoleRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: CreateAgentRoleInput): Promise<AgentRole> {
    if (!ALLOWED_ROLES.includes(input.requestedByRole)) {
      throw new AppError('FORBIDDEN', 'Apenas administradores e operadores podem criar papéis')
    }

    if (!input.name.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Nome do papel não pode ser vazio')
    }

    if (!input.category.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Categoria do papel não pode ser vazia')
    }

    // Check if duplicate name in tenant or global
    const [byTenant, byGlobal] = await Promise.all([
      this.roleRepo.findByName(input.name, input.tenantId),
      this.roleRepo.findByName(input.name, null),
    ])

    if (byTenant || byGlobal) {
      throw new AppError('ROLE_NAME_DUPLICATED', 'Já existe um papel com este nome')
    }

    const role = await this.roleRepo.create({
      tenantId: input.tenantId,
      name: input.name.trim(),
      category: input.category.trim(),
      description: input.description?.trim(),
    })

    await this.auditLogger.log({
      action: 'agent_role.created',
      tenantId: input.tenantId,
      resourceId: role.id,
      resourceType: 'agent_role',
      metadata: { name: role.name, category: role.category },
    })

    return role
  }
}
