import { randomUUID } from 'crypto'
import type { AgentRole, CreateAgentRoleData } from '@/domains/agent/entities/AgentRole'
import type { IAgentRoleRepository } from '@/domains/agent/repositories/IAgentRoleRepository'

const store = new Map<string, AgentRole>()

// Seed initial global roles in-memory
const GLOBAL_ROLES: Omit<AgentRole, 'createdAt' | 'updatedAt'>[] = [
  { id: '550e8400-e29b-41d4-a716-446655440001', tenantId: null, name: 'SDR', category: 'Comercial', description: 'Prospecção e qualificação de leads' },
  { id: '550e8400-e29b-41d4-a716-446655440002', tenantId: null, name: 'Support N1', category: 'Suporte', description: 'Atendimento de primeiro nível' },
  { id: '550e8400-e29b-41d4-a716-446655440003', tenantId: null, name: 'Negotiator', category: 'Comercial', description: 'Negociação de propostas e valores' },
  { id: '550e8400-e29b-41d4-a716-446655440004', tenantId: null, name: 'Onboarding Specialist', category: 'Atendimento', description: 'Integração de novos clientes' },
  { id: '550e8400-e29b-41d4-a716-446655440005', tenantId: null, name: 'Commercial Director', category: 'Comercial', description: 'Direção comercial e supervisão' },
  { id: '550e8400-e29b-41d4-a716-446655440006', tenantId: null, name: 'Lead Hunter', category: 'Comercial', description: 'Busca ativa de novos contatos' },
  { id: '550e8400-e29b-41d4-a716-446655440007', tenantId: null, name: 'Lead Qualifier', category: 'Comercial', description: 'Qualificação avançada de leads' },
  { id: '550e8400-e29b-41d4-a716-446655440008', tenantId: null, name: 'Message Strategist', category: 'Comercial', description: 'Elaboração de copys e abordagens' },
  { id: '550e8400-e29b-41d4-a716-446655440009', tenantId: null, name: 'Engagement Monitor', category: 'Comercial', description: 'Monitoramento de engajamento do lead' },
  { id: '550e8400-e29b-41d4-a716-446655440010', tenantId: null, name: 'Follow-up Hunter', category: 'Comercial', description: 'Reativação e follow-up persistente' },
  { id: '550e8400-e29b-41d4-a716-446655440011', tenantId: null, name: 'Proposal Agent', category: 'Comercial', description: 'Criação e envio de propostas' },
  { id: '550e8400-e29b-41d4-a716-446655440012', tenantId: null, name: 'Closer Assistant', category: 'Comercial', description: 'Suporte ao fechamento de negócios' },
]

for (const r of GLOBAL_ROLES) {
  store.set(r.id, {
    ...r,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

export class InMemoryAgentRoleRepository implements IAgentRoleRepository {
  async findById(id: string): Promise<AgentRole | null> {
    return store.get(id) ?? null
  }

  async findByName(name: string, tenantId: string | null): Promise<AgentRole | null> {
    return Array.from(store.values()).find(
      (r) => r.name.toLowerCase() === name.toLowerCase() && r.tenantId === tenantId
    ) ?? null
  }

  async list(tenantId: string): Promise<AgentRole[]> {
    return Array.from(store.values()).filter(
      (r) => r.tenantId === null || r.tenantId === tenantId
    )
  }

  async create(data: CreateAgentRoleData): Promise<AgentRole> {
    const role: AgentRole = {
      id: randomUUID(),
      tenantId: data.tenantId ?? null,
      name: data.name,
      category: data.category,
      description: data.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    store.set(role.id, role)
    return role
  }
}
