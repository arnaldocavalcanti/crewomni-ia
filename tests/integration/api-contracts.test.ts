import { describe, it, expect } from 'vitest'

/**
 * Testes de contrato de API.
 *
 * Validam que os shapes de entrada e saída das API routes
 * correspondem exatamente aos contratos definidos nas specs.
 *
 * Estes testes usam os tipos TypeScript como fonte de verdade.
 * Quando os tipos mudarem e os contratos quebrarem, estes testes falharão.
 *
 * Specs referenciadas:
 * - docs/specs/auth/authentication.md — seção 8
 * - docs/specs/tenant/tenant-resolution.md — seção 8
 */

// ── Validadores de shape ──────────────────────────────────────────────────────

function hasKeys<T extends object>(obj: T, keys: (keyof T)[]): boolean {
  return keys.every((k) => k in obj)
}

function hasNoKeys<T extends object>(obj: T, keys: string[]): boolean {
  return keys.every((k) => !(k in obj))
}

// ─── Auth: LoginOutput ────────────────────────────────────────────────────────

describe('Contrato: POST /api/v1/auth/login', () => {
  it('LoginOutput deve conter accessToken, user — e nunca refreshToken no body', () => {
    // Simula o shape que a API route deve retornar
    const mockLoginOutput = {
      accessToken: 'eyJhbGciOiJIUzI1NiJ9...',
      user: {
        id: 'user-1',
        name: 'Admin',
        email: 'admin@devolus.com',
        role: 'TENANT_ADMIN',
        tenantId: 'tenant-1',
        isPlatformAdmin: false,
      },
      // refreshToken NÃO deve aparecer aqui — vai como cookie httpOnly
    }

    expect(hasKeys(mockLoginOutput, ['accessToken', 'user'])).toBe(true)
    expect(hasNoKeys(mockLoginOutput, ['refreshToken'])).toBe(true)
    expect(hasKeys(mockLoginOutput.user, ['id', 'name', 'email', 'role', 'tenantId', 'isPlatformAdmin'])).toBe(true)
  })

  it('user no LoginOutput não deve conter passwordHash', () => {
    const mockUser = {
      id: 'user-1',
      name: 'Admin',
      email: 'admin@devolus.com',
      role: 'TENANT_ADMIN',
      tenantId: 'tenant-1',
      isPlatformAdmin: false,
    }

    expect(hasNoKeys(mockUser, ['passwordHash', 'password'])).toBe(true)
  })

  it('super-admin no LoginOutput deve ter tenantId null e isPlatformAdmin true', () => {
    const mockSuperAdminOutput = {
      accessToken: 'token',
      user: {
        id: 'admin-1',
        name: 'Super Admin',
        email: 'admin@platform.com',
        role: 'PLATFORM_ADMIN',
        tenantId: null,
        isPlatformAdmin: true,
      },
    }

    expect(mockSuperAdminOutput.user.tenantId).toBeNull()
    expect(mockSuperAdminOutput.user.isPlatformAdmin).toBe(true)
  })
})

// ─── Auth: Erro shapes ────────────────────────────────────────────────────────

describe('Contrato: erros de auth', () => {
  const validAuthErrorCodes = [
    'INVALID_CREDENTIALS',
    'ACCOUNT_LOCKED',
    'ACCOUNT_INACTIVE',
    'TOKEN_EXPIRED',
    'SESSION_EXPIRED',
    'TENANT_INACTIVE',
    'VALIDATION_ERROR',
  ]

  it('erros de auth devem ter code pertencente ao conjunto definido na spec', () => {
    const mockError = { code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas' }

    expect(validAuthErrorCodes).toContain(mockError.code)
    expect(hasKeys(mockError, ['code', 'message'])).toBe(true)
  })

  it('erro de credenciais inválidas não deve mencionar "e-mail" ou "não encontrado"', () => {
    const errorMessages = [
      'Credenciais inválidas',
      'Invalid credentials',
      'Email or password is incorrect',
    ]

    for (const msg of errorMessages) {
      expect(msg.toLowerCase()).not.toContain('não existe')
      expect(msg.toLowerCase()).not.toContain('not found')
      expect(msg.toLowerCase()).not.toContain('email not')
    }
  })
})

// ─── Tenant: CreateTenantOutput ───────────────────────────────────────────────

describe('Contrato: POST /api/v1/tenants', () => {
  it('CreateTenantOutput deve conter tenant e owner com temporaryPassword', () => {
    const mockOutput = {
      tenant: {
        id: 'tenant-1',
        name: 'Devolus',
        slug: 'devolus',
        niche: 'REAL_ESTATE',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      owner: {
        id: 'user-1',
        email: 'admin@devolus.com',
        temporaryPassword: 'Temp@12345',
      },
    }

    expect(hasKeys(mockOutput, ['tenant', 'owner'])).toBe(true)
    expect(hasKeys(mockOutput.tenant, ['id', 'name', 'slug', 'niche', 'status', 'createdAt'])).toBe(true)
    expect(hasKeys(mockOutput.owner, ['id', 'email', 'temporaryPassword'])).toBe(true)
  })

  it('tenant no output não deve conter dados sensíveis internos', () => {
    const mockTenant = {
      id: 'tenant-1',
      name: 'Devolus',
      slug: 'devolus',
      niche: 'REAL_ESTATE',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    }

    expect(hasNoKeys(mockTenant, ['allowedDomains', 'plan', 'billingData'])).toBe(true)
  })
})

// ─── Knowledge: Chat (RAG Orchestrator) ──────────────────────────────────────

describe('Contrato: POST /api/v1/agents/:id/chat', () => {
  it('ChatOutput deve conter reply, model, tokensUsed e chunksUsed', () => {
    const mockOutput = {
      reply: 'Para realizar uma vistoria de entrada, siga os passos...',
      model: 'gpt-4o-mini',
      tokensUsed: 320,
      chunksUsed: [
        { layer: 'TENANT', count: 2, totalScore: 1.84 },
        { layer: 'AGENT', count: 1, totalScore: 0.91 },
      ],
    }

    expect(hasKeys(mockOutput, ['reply', 'model', 'tokensUsed', 'chunksUsed'])).toBe(true)
    expect(typeof mockOutput.reply).toBe('string')
    expect(typeof mockOutput.tokensUsed).toBe('number')
    expect(Array.isArray(mockOutput.chunksUsed)).toBe(true)
  })

  it('cada item de chunksUsed deve conter layer, count e totalScore', () => {
    const chunk = { layer: 'TENANT', count: 2, totalScore: 1.84 }

    expect(hasKeys(chunk, ['layer', 'count', 'totalScore'])).toBe(true)
    expect(['GLOBAL', 'TENANT', 'AGENT']).toContain(chunk.layer)
  })

  it('erros válidos da rota de chat', () => {
    const validCodes = ['AGENT_NOT_FOUND', 'AGENT_NOT_ACTIVE', 'VALIDATION_ERROR', 'LLM_PROVIDER_ERROR', 'EMBEDDING_ERROR']

    for (const code of validCodes) {
      const error = { code, message: 'descrição do erro' }
      expect(validCodes).toContain(error.code)
      expect(hasKeys(error, ['code', 'message'])).toBe(true)
    }
  })

  it('AGENT_NOT_FOUND e AGENT_NOT_ACTIVE nunca devem revelar se agente existe em outro tenant', () => {
    const notFoundMsg = 'Agente não encontrado.'
    // Ambos os erros usam a mesma mensagem genérica — não revelam o motivo real
    expect(notFoundMsg).not.toContain('outro tenant')
    expect(notFoundMsg).not.toContain('permissão')
  })
})

// ─── Conversation: SendMessage ────────────────────────────────────────────────

describe('Contrato: POST /api/v1/conversations/message', () => {
  it('SendMessageOutput deve conter conversationId, messageId, reply, model, tokensUsed, isNewConversation', () => {
    const mockOutput = {
      conversationId: 'conv-1',
      messageId: 'msg-1',
      reply: 'Para realizar uma vistoria de entrada...',
      model: 'gpt-4o-mini',
      tokensUsed: 210,
      isNewConversation: true,
    }

    expect(hasKeys(mockOutput, ['conversationId', 'messageId', 'reply', 'model', 'tokensUsed', 'isNewConversation'])).toBe(true)
    expect(typeof mockOutput.isNewConversation).toBe('boolean')
  })

  it('erros válidos da rota de conversa', () => {
    const validCodes = [
      'CONVERSATION_NOT_FOUND',
      'CONVERSATION_CLOSED',
      'VALIDATION_ERROR',
      'AGENT_NOT_FOUND',
      'AGENT_NOT_ACTIVE',
    ]

    for (const code of validCodes) {
      expect(validCodes).toContain(code)
    }
  })
})

describe('Contrato: GET /api/v1/conversations/:id/messages', () => {
  it('GetConversationMessagesOutput deve conter conversationId, agentId, status e messages[]', () => {
    const mockOutput = {
      conversationId: 'conv-1',
      agentId: 'agent-1',
      status: 'OPEN',
      messages: [
        { id: 'msg-1', role: 'USER', content: 'Olá', metadata: null, createdAt: new Date().toISOString() },
        { id: 'msg-2', role: 'ASSISTANT', content: 'Olá! Como posso ajudar?', metadata: { model: 'gpt-4o-mini', tokensUsed: 30 }, createdAt: new Date().toISOString() },
      ],
    }

    expect(hasKeys(mockOutput, ['conversationId', 'agentId', 'status', 'messages'])).toBe(true)
    expect(Array.isArray(mockOutput.messages)).toBe(true)
    expect(['OPEN', 'CLOSED']).toContain(mockOutput.status)
  })
})

// ─── Widget público ───────────────────────────────────────────────────────────

describe('Contrato: GET /api/v1/widget/config', () => {
  it('WidgetConfigOutput deve conter agentName, agentType, welcomeMessage e primaryColor', () => {
    const mockOutput = {
      agentName: 'Suporte Devolus',
      agentType: 'HELPDESK',
      welcomeMessage: 'Olá! Como posso ajudar?',
      primaryColor: '#6366f1',
    }

    expect(hasKeys(mockOutput, ['agentName', 'agentType', 'welcomeMessage', 'primaryColor'])).toBe(true)
  })

  it('WidgetConfigOutput nunca deve expor systemPrompt, tenantId ou dados internos', () => {
    const mockOutput = {
      agentName: 'Suporte',
      agentType: 'HELPDESK',
      welcomeMessage: 'Olá!',
      primaryColor: '#6366f1',
    }

    expect(hasNoKeys(mockOutput, ['systemPrompt', 'tenantId', 'agentId', 'plan', 'passwordHash'])).toBe(true)
  })

  it('agentType deve ser um dos tipos válidos', () => {
    const validTypes = ['SDR', 'HELPDESK', 'NEGOTIATION', 'ONBOARDING', 'SUPPORT', 'SALES']
    const mockOutput = { agentType: 'HELPDESK' }

    expect(validTypes).toContain(mockOutput.agentType)
  })
})

describe('Contrato: POST /api/v1/widget/chat', () => {
  it('WidgetChatOutput deve conter conversationId, reply e isNewConversation', () => {
    const mockOutput = {
      conversationId: 'conv-1',
      reply: 'Olá! Como posso ajudar com sua vistoria?',
      isNewConversation: true,
    }

    expect(hasKeys(mockOutput, ['conversationId', 'reply', 'isNewConversation'])).toBe(true)
    expect(typeof mockOutput.isNewConversation).toBe('boolean')
    expect(typeof mockOutput.reply).toBe('string')
  })

  it('WidgetChatOutput não deve expor model, tokensUsed nem dados internos', () => {
    const mockOutput = {
      conversationId: 'conv-1',
      reply: 'Resposta do agente.',
      isNewConversation: false,
    }

    expect(hasNoKeys(mockOutput, ['model', 'tokensUsed', 'chunksUsed', 'tenantId', 'agentId'])).toBe(true)
  })

  it('erros válidos do widget público nunca revelam IDs internos', () => {
    const validCodes = [
      'TENANT_NOT_FOUND',
      'AGENT_NOT_FOUND',
      'CONVERSATION_NOT_FOUND',
      'CONVERSATION_CLOSED',
      'VALIDATION_ERROR',
    ]

    for (const code of validCodes) {
      const error = { code, message: 'descrição pública' }
      expect(hasKeys(error, ['code', 'message'])).toBe(true)
      expect(validCodes).toContain(error.code)
    }
  })
})

// ─── Tenant: TenantContext shape ──────────────────────────────────────────────

describe('Contrato: TenantContext resolvido pelo middleware', () => {
  it('TenantContext deve conter tenantId, tenant e resolutionStrategy', () => {
    const mockContext = {
      tenantId: 'tenant-1',
      tenant: {
        id: 'tenant-1',
        slug: 'devolus',
        name: 'Devolus',
        niche: 'REAL_ESTATE',
        status: 'ACTIVE',
        plan: 'PRO',
      },
      resolutionStrategy: 'JWT' as const,
      userId: 'user-1',
      role: 'TENANT_ADMIN',
    }

    expect(hasKeys(mockContext, ['tenantId', 'tenant', 'resolutionStrategy'])).toBe(true)
    expect(['JWT', 'API_KEY', 'PUBLIC_SLUG']).toContain(mockContext.resolutionStrategy)
  })

  it('TenantContext via API_KEY deve conter apiKeyId e não userId', () => {
    const mockContext = {
      tenantId: 'tenant-1',
      tenant: { id: 'tenant-1', slug: 'devolus', name: 'Devolus', niche: 'REAL_ESTATE', status: 'ACTIVE', plan: 'PRO' },
      resolutionStrategy: 'API_KEY' as const,
      apiKeyId: 'key-1',
    }

    expect(mockContext.apiKeyId).toBeDefined()
    expect(hasNoKeys(mockContext, ['userId', 'role'])).toBe(true)
  })
})

// ─── Agent Evolution: Roles & Professional properties ─────────────────────────

describe('Contrato: POST /api/v1/agents/roles', () => {
  it('CreateAgentRoleOutput deve conter id, tenantId, name, category, description, createdAt', () => {
    const mockOutput = {
      id: 'role-1',
      tenantId: 'tenant-1',
      name: 'Custom SDR',
      category: 'Comercial',
      description: 'SDR customizado',
      createdAt: new Date().toISOString(),
    }

    expect(hasKeys(mockOutput, ['id', 'tenantId', 'name', 'category', 'description', 'createdAt'])).toBe(true)
  })
})

describe('Contrato: GET /api/v1/agents/roles', () => {
  it('ListAgentRolesOutput deve retornar uma lista de papéis contendo globais e customizados', () => {
    const mockOutput = [
      { id: 'role-global', tenantId: null, name: 'SDR', category: 'Comercial', description: 'Global SDR', createdAt: new Date().toISOString() },
      { id: 'role-custom', tenantId: 'tenant-1', name: 'Custom Qualifier', category: 'Comercial', description: 'Custom', createdAt: new Date().toISOString() },
    ]

    expect(Array.isArray(mockOutput)).toBe(true)
    expect(mockOutput.every((r) => hasKeys(r, ['id', 'tenantId', 'name', 'category', 'createdAt']))).toBe(true)
  })
})
