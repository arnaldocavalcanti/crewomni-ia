# Segurança — AI Agent Hub

## Princípios

- **Defense in depth**: isolamento em múltiplas camadas — código, banco, infra
- **Least privilege**: cada componente acessa apenas o que precisa
- **Fail secure**: em caso de erro, negar acesso — nunca liberar por padrão
- **Auditability**: toda ação sensível é registrada com contexto suficiente para investigação

## Autenticação e autorização

- Toda API route privada verifica sessão antes de qualquer operação
- `tenantId` é sempre extraído da sessão — nunca do body ou query param
- Permissões verificadas no middleware e novamente no use-case (dupla verificação)
- JWT com expiração curta (1h) + refresh token rotativo

## Isolamento multi-tenant

```typescript
// CORRETO: tenantId vem da sessão
const agent = await agentRepository.findById({ id, tenantId: session.tenantId })

// ERRADO: nunca aceite tenantId do cliente
const agent = await agentRepository.findById({ id, tenantId: req.body.tenantId })
```

- Row Level Security (RLS) habilitado no PostgreSQL para todas as tabelas com `tenantId`
- Vector store: namespace separado por tenant — nunca query cross-tenant
- Redis: prefixo `tenant:{id}:` obrigatório em todas as chaves

## Prompts e LLM

- Nunca injete input do usuário diretamente no system prompt sem sanitização
- System prompt é sempre montado pelo servidor — nunca pelo cliente
- `tenantId` e dados internos nunca aparecem no prompt enviado ao LLM
- Respostas do LLM são sanitizadas antes de retornar ao cliente

## API

- Rate limiting por tenant (configurável por plano)
- CORS restrito aos domínios cadastrados do tenant
- Todas as rotas públicas (widget de chat) têm rate limiting por IP
- Input validation em todas as API routes (Zod)
- Headers de segurança: CSP, HSTS, X-Frame-Options

## Segredos e variáveis de ambiente

- Nenhum segredo no código ou em comentários
- `.env.local` nunca commitado
- Variáveis de ambiente documentadas em `.env.example` sem valores reais
- Chaves de API rotacionadas por tenant — nunca compartilhadas

## Audit log

Todo evento de segurança deve ser registrado:

```typescript
type AuditEvent = {
  tenantId: string
  userId: string | null
  action: string         // ex: 'agent.created', 'knowledge.accessed'
  resourceId: string
  resourceType: string
  metadata: Record<string, unknown>
  ip: string
  timestamp: Date
}
```

Eventos obrigatórios de audit:
- Login / logout
- Criação, edição e exclusão de agentes
- Acesso à knowledge base
- Execução de turn de conversa
- Operações da KDL (análise, aprovação, publicação)
- Exportação de dados
- Exclusão de dados (direito ao esquecimento)

## Checklist antes de abrir PR com mudanças de segurança

- [ ] `tenantId` vem sempre da sessão?
- [ ] Input validado com Zod?
- [ ] Audit log cobre a nova operação?
- [ ] Rate limiting aplicado em rotas públicas?
- [ ] Nenhum segredo no código?
- [ ] Testes de isolamento de tenant escritos?
- [ ] RLS cobre a nova tabela?
