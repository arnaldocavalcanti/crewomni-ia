import type { CreateQualificationSchemaData } from '@/domains/qualification/entities/QualificationSchema'

export const vistoriaImobiliariaSchema: CreateQualificationSchemaData = {
  tenantId: null, // global — disponível para todos os tenants
  nicheKey: 'vistoria-imobiliaria',
  version: 1,
  fields: [
    {
      key: 'tipo_empresa',
      type: 'enum',
      enum: ['imobiliaria', 'empresa_vistoria', 'vistoriador_autonomo', 'administradora', 'outro'],
      label: 'Tipo de empresa',
    },
    { key: 'nome_empresa', type: 'string', label: 'Nome da empresa' },
    { key: 'nome_contato', type: 'string', label: 'Nome do contato' },
    { key: 'cidade_uf', type: 'string', label: 'Cidade / UF' },
    {
      key: 'tipo_vistoria',
      type: 'enum',
      enum: ['propria', 'terceirizada', 'mista'],
      label: 'Como fazem as vistorias',
    },
    { key: 'volume_mensal', type: 'integer', min: 0, max: 10000, label: 'Volume mensal de vistorias' },
    { key: 'num_vistoriadores', type: 'integer', min: 0, max: 1000, label: 'Número de vistoriadores' },
    {
      key: 'sistema_atual',
      type: 'enum',
      enum: ['nenhum', 'interno', 'word', 'pdf', 'planilha', 'formulario', 'outro_app'],
      label: 'Sistema atual de vistoria',
    },
    { key: 'motivo_mudanca', type: 'string', label: 'Motivo de querer mudar' },
    { key: 'dor_principal', type: 'string', label: 'Principal dor / problema' },
    {
      key: 'urgencia',
      type: 'enum',
      enum: ['pesquisando', 'trocar_em_breve', 'imediata'],
      label: 'Urgência de mudança',
    },
    { key: 'interesse_demo', type: 'boolean', label: 'Interesse em demonstração' },
    { key: 'interesse_video', type: 'boolean', label: 'Interesse em vídeo' },
    { key: 'whatsapp', type: 'string', label: 'WhatsApp' },
    { key: 'email', type: 'string', label: 'E-mail' },
  ],
  order: [
    'tipo_empresa',
    'nome_empresa',
    'cidade_uf',
    'tipo_vistoria',
    'volume_mensal',
    'num_vistoriadores',
    'sistema_atual',
    'dor_principal',
    'urgencia',
    'interesse_demo',
    'interesse_video',
    'whatsapp',
    'email',
  ],
}

// Generic fallback schema — used when agent has no schema configured
export const genericSchema: CreateQualificationSchemaData = {
  tenantId: null,
  nicheKey: 'generic',
  version: 1,
  fields: [
    { key: 'tipo_empresa', type: 'string', label: 'Tipo de empresa' },
    { key: 'nome_contato', type: 'string', label: 'Nome do contato' },
    { key: 'telefone', type: 'string', label: 'Telefone' },
    { key: 'email', type: 'string', label: 'E-mail' },
    { key: 'nivel_interesse', type: 'string', label: 'Nível de interesse' },
    { key: 'objecao', type: 'string', label: 'Objeção' },
  ],
  order: ['tipo_empresa', 'nome_contato', 'nivel_interesse', 'objecao', 'telefone', 'email'],
}
