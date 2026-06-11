import { describe, it, expect, beforeEach } from 'vitest'
import { ValidateAndMerge } from '@/domains/qualification/use-cases/ValidateAndMerge'
import { InMemoryQualificationStateRepository } from '@/infrastructure/db/repositories/InMemoryQualificationStateRepository'
import type { QualificationSchema } from '@/domains/qualification/entities/QualificationSchema'
import type { QualificationState } from '@/domains/qualification/entities/QualificationState'
import { ConversationStage } from '@/domains/qualification/entities/QualificationState'

// Minimal audit logger stub
const auditLogger = { log: async () => {} }

const schema: QualificationSchema = {
  id: 'schema-1',
  tenantId: null,
  nicheKey: 'vistoria-imobiliaria',
  version: 1,
  fields: [
    { key: 'tipo_empresa', type: 'enum', enum: ['imobiliaria', 'empresa_vistoria', 'outro'] },
    { key: 'nome_empresa', type: 'string' },
    { key: 'volume_mensal', type: 'integer', min: 0, max: 10000 },
    { key: 'tipo_vistoria', type: 'enum', enum: ['propria', 'terceirizada', 'mista'] },
    { key: 'interesse_demo', type: 'boolean' },
  ],
  order: ['tipo_empresa', 'nome_empresa', 'volume_mensal', 'tipo_vistoria', 'interesse_demo'],
  createdAt: new Date(),
}

let repo: InMemoryQualificationStateRepository
let useCase: ValidateAndMerge
let baseState: QualificationState

beforeEach(async () => {
  repo = new InMemoryQualificationStateRepository()
  ;(repo as any).clear()
  useCase = new ValidateAndMerge(repo, auditLogger as any)
  baseState = await repo.create({
    conversationId: 'conv-1',
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    schemaId: 'schema-1',
  })
})

describe('ValidateAndMerge', () => {
  it('deve aceitar enum válido com evidência e registrar changedKeys', async () => {
    const result = await useCase.execute({
      state: baseState,
      schema,
      delta: [{ field: 'tipo_empresa', value: 'imobiliaria', evidence: 'sou de imobiliária' }],
    })
    expect(result.changedKeys).toContain('tipo_empresa')
    expect(result.rejectedKeys).not.toContain('tipo_empresa')
    expect(result.newState.fields.tipo_empresa).toBe('imobiliaria')
  })

  it('deve rejeitar enum inválido e manter valor anterior', async () => {
    // preset um valor válido
    const stateWithValue = await repo.update(baseState.id, 'tenant-1', {
      fields: { tipo_empresa: 'imobiliaria' },
    })
    const result = await useCase.execute({
      state: stateWithValue,
      schema,
      delta: [{ field: 'tipo_empresa', value: 'valor_invalido', evidence: 'sou valor invalido' }],
    })
    expect(result.rejectedKeys).toContain('tipo_empresa')
    expect(result.newState.fields.tipo_empresa).toBe('imobiliaria')
  })

  it('deve rejeitar integer fora do range (máximo)', async () => {
    const result = await useCase.execute({
      state: baseState,
      schema,
      delta: [{ field: 'volume_mensal', value: 99999, evidence: '99999 vistorias' }],
    })
    expect(result.rejectedKeys).toContain('volume_mensal')
  })

  it('deve rejeitar integer fora do range (mínimo negativo)', async () => {
    const result = await useCase.execute({
      state: baseState,
      schema,
      delta: [{ field: 'volume_mensal', value: -5, evidence: 'menos 5' }],
    })
    expect(result.rejectedKeys).toContain('volume_mensal')
  })

  it('deve aceitar integer dentro do range', async () => {
    const result = await useCase.execute({
      state: baseState,
      schema,
      delta: [{ field: 'volume_mensal', value: 50, evidence: 'fazemos 50 por mês' }],
    })
    expect(result.changedKeys).toContain('volume_mensal')
    expect(result.newState.fields.volume_mensal).toBe(50)
  })

  it('deve manter valor existente sem evidência (proteção anti-sobrescrita)', async () => {
    const stateWithValue = await repo.update(baseState.id, 'tenant-1', {
      fields: { tipo_empresa: 'imobiliaria' },
    })
    const result = await useCase.execute({
      state: stateWithValue,
      schema,
      delta: [{ field: 'tipo_empresa', value: 'outro', evidence: null }],
    })
    expect(result.rejectedKeys).toContain('tipo_empresa')
    expect(result.newState.fields.tipo_empresa).toBe('imobiliaria')
  })

  it('deve sobrescrever valor existente com evidência explícita', async () => {
    const stateWithValue = await repo.update(baseState.id, 'tenant-1', {
      fields: { tipo_empresa: 'imobiliaria' },
    })
    const result = await useCase.execute({
      state: stateWithValue,
      schema,
      delta: [{ field: 'tipo_empresa', value: 'outro', evidence: 'na verdade somos outro tipo' }],
    })
    expect(result.changedKeys).toContain('tipo_empresa')
    expect(result.newState.fields.tipo_empresa).toBe('outro')
  })

  it('deve ignorar silenciosamente campo fora do schema', async () => {
    const result = await useCase.execute({
      state: baseState,
      schema,
      delta: [{ field: 'campo_inexistente', value: 'qualquer', evidence: 'algo' }],
    })
    expect(result.changedKeys).not.toContain('campo_inexistente')
    expect(result.rejectedKeys).not.toContain('campo_inexistente')
  })

  it('deve aceitar booleano válido', async () => {
    const result = await useCase.execute({
      state: baseState,
      schema,
      delta: [{ field: 'interesse_demo', value: true, evidence: 'quero ver uma demo' }],
    })
    expect(result.changedKeys).toContain('interesse_demo')
    expect(result.newState.fields.interesse_demo).toBe(true)
  })

  it('isolamento multi-tenant: deve lançar erro ao tentar atualizar estado de outro tenant', async () => {
    await expect(
      useCase.execute({
        state: { ...baseState, tenantId: 'tenant-outro' },
        schema,
        delta: [{ field: 'tipo_empresa', value: 'imobiliaria', evidence: 'imobiliária' }],
      }),
    ).rejects.toThrow()
  })
})
