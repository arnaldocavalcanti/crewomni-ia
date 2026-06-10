import { PrismaClient } from '@prisma/client'
import { AuthenticateUser } from '@/domains/auth/use-cases/AuthenticateUser'
import { RefreshSession } from '@/domains/auth/use-cases/RefreshSession'
import { LogoutUser } from '@/domains/auth/use-cases/LogoutUser'
import { CreateTenant } from '@/domains/tenant/use-cases/CreateTenant'
import { ResolveTenantContext } from '@/domains/tenant/use-cases/ResolveTenantContext'
import { CreateAgent } from '@/domains/agent/use-cases/CreateAgent'
import { CreateAgentRole } from '@/domains/agent/use-cases/CreateAgentRole'
import { ListAgentRoles } from '@/domains/agent/use-cases/ListAgentRoles'
import { PublishAgentPrompt } from '@/domains/agent/use-cases/PublishAgentPrompt'
import { GetAgent } from '@/domains/agent/use-cases/GetAgent'
import { ListAgents } from '@/domains/agent/use-cases/ListAgents'
import { UpdateAgentStatus } from '@/domains/agent/use-cases/UpdateAgentStatus'
import { UpdateAgent } from '@/domains/agent/use-cases/UpdateAgent'
import { IngestDocument } from '@/domains/knowledge/use-cases/IngestDocument'
import { SearchKnowledge } from '@/domains/knowledge/use-cases/SearchKnowledge'
import { DeleteDocument } from '@/domains/knowledge/use-cases/DeleteDocument'
import { ListDocuments } from '@/domains/knowledge/use-cases/ListDocuments'
import { BcryptPasswordHasher } from '@/infrastructure/auth/BcryptPasswordHasher'
import { ConsoleAuditLogger } from '@/infrastructure/audit/ConsoleAuditLogger'
import { PrismaAuditLogger } from '@/infrastructure/audit/PrismaAuditLogger'
import { InMemoryUserRepository } from '@/infrastructure/db/repositories/InMemoryUserRepository'
import { InMemoryRefreshTokenRepository } from '@/infrastructure/db/repositories/InMemoryRefreshTokenRepository'
import { InMemoryTenantRepository } from '@/infrastructure/db/repositories/InMemoryTenantRepository'
import { InMemoryApiKeyRepository } from '@/infrastructure/db/repositories/InMemoryApiKeyRepository'
import { InMemoryAgentRepository } from '@/infrastructure/db/repositories/InMemoryAgentRepository'
import { InMemoryAgentRoleRepository } from '@/infrastructure/db/repositories/InMemoryAgentRoleRepository'
import { InMemoryAgentPromptVersionRepository } from '@/infrastructure/db/repositories/InMemoryAgentPromptVersionRepository'
import { InMemoryKnowledgeDocumentRepository } from '@/infrastructure/db/repositories/InMemoryKnowledgeDocumentRepository'
import { InMemoryVectorRepository } from '@/infrastructure/vector/InMemoryVectorRepository'
import { PrismaUserRepository } from '@/infrastructure/db/repositories/PrismaUserRepository'
import { PrismaRefreshTokenRepository } from '@/infrastructure/db/repositories/PrismaRefreshTokenRepository'
import { PrismaTenantRepository } from '@/infrastructure/db/repositories/PrismaTenantRepository'
import { PrismaApiKeyRepository } from '@/infrastructure/db/repositories/PrismaApiKeyRepository'
import { PrismaAgentRepository } from '@/infrastructure/db/repositories/PrismaAgentRepository'
import { PrismaAgentRoleRepository } from '@/infrastructure/db/repositories/PrismaAgentRoleRepository'
import { PrismaAgentPromptVersionRepository } from '@/infrastructure/db/repositories/PrismaAgentPromptVersionRepository'
import { PrismaKnowledgeDocumentRepository } from '@/infrastructure/db/repositories/PrismaKnowledgeDocumentRepository'
import { OpenAIEmbeddingProvider } from '@/infrastructure/llm/openai/OpenAIEmbeddingProvider'
import { OpenAILLMProvider } from '@/infrastructure/llm/openai/OpenAILLMProvider'
import { BuildRAGContext } from '@/domains/knowledge/use-cases/BuildRAGContext'
import { SendMessage } from '@/domains/conversation/use-cases/SendMessage'
import { ListConversations } from '@/domains/conversation/use-cases/ListConversations'
import { GetConversationMessages } from '@/domains/conversation/use-cases/GetConversationMessages'
import { TransferConversation } from '@/domains/conversation/use-cases/TransferConversation'
import { GetConversationDetails } from '@/domains/conversation/use-cases/GetConversationDetails'
import { OperatorReply } from '@/domains/conversation/use-cases/OperatorReply'
import { GetAgentBySlug } from '@/domains/agent/use-cases/GetAgentBySlug'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { PrismaConversationRepository } from '@/infrastructure/db/repositories/PrismaConversationRepository'
import { CreateDepartment } from '@/domains/organization/use-cases/CreateDepartment'
import { ListDepartments } from '@/domains/organization/use-cases/ListDepartments'
import { GetDepartment } from '@/domains/organization/use-cases/GetDepartment'
import { UpdateDepartment } from '@/domains/organization/use-cases/UpdateDepartment'
import { DeleteDepartment } from '@/domains/organization/use-cases/DeleteDepartment'
import { InMemoryDepartmentRepository } from '@/infrastructure/db/repositories/InMemoryDepartmentRepository'
import { PrismaDepartmentRepository } from '@/infrastructure/db/repositories/PrismaDepartmentRepository'
import { CreateCrew } from '@/domains/crew/use-cases/CreateCrew'
import { ListCrews } from '@/domains/crew/use-cases/ListCrews'
import { GetCrew } from '@/domains/crew/use-cases/GetCrew'
import { UpdateCrew } from '@/domains/crew/use-cases/UpdateCrew'
import { DeleteCrew } from '@/domains/crew/use-cases/DeleteCrew'
import { AddAgentToCrew } from '@/domains/crew/use-cases/AddAgentToCrew'
import { RemoveAgentFromCrew } from '@/domains/crew/use-cases/RemoveAgentFromCrew'
import { ListCrewMembers } from '@/domains/crew/use-cases/ListCrewMembers'
import { GetCrewBySlug } from '@/domains/crew/use-cases/GetCrewBySlug'
import { GetCrewMetrics } from '@/domains/crew/use-cases/GetCrewMetrics'
import { SimulateCrewMessage } from '@/domains/crew/use-cases/SimulateCrewMessage'
import { InMemoryCrewRepository } from '@/infrastructure/db/repositories/InMemoryCrewRepository'
import { InMemoryCrewMemberRepository } from '@/infrastructure/db/repositories/InMemoryCrewMemberRepository'
import { PrismaCrewRepository } from '@/infrastructure/db/repositories/PrismaCrewRepository'
import { PrismaCrewMemberRepository } from '@/infrastructure/db/repositories/PrismaCrewMemberRepository'
import { InMemoryQualificationStateRepository } from '@/infrastructure/db/repositories/InMemoryQualificationStateRepository'
import { PrismaQualificationStateRepository } from '@/infrastructure/db/repositories/PrismaQualificationStateRepository'
import { ExtractAndUpdateState } from '@/domains/qualification/use-cases/ExtractAndUpdateState'
import { InMemoryTenantUsageLimitRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageLimitRepository'
import { InMemoryTenantUsageCurrentRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageCurrentRepository'
import { PrismaTenantUsageLimitRepository } from '@/infrastructure/db/repositories/PrismaTenantUsageLimitRepository'
import { PrismaTenantUsageCurrentRepository } from '@/infrastructure/db/repositories/PrismaTenantUsageCurrentRepository'
import { CheckAndEnforceUsageLimit } from '@/domains/usage-limits/use-cases/CheckAndEnforceUsageLimit'
import { RecordUsage } from '@/domains/usage-limits/use-cases/RecordUsage'
import { UpdateTenantUsageLimit } from '@/domains/usage-limits/use-cases/UpdateTenantUsageLimit'

// Distillation - Fase 2.4
import { RunKDL } from '@/domains/distillation/use-cases/RunKDL'
import { ReviewKDLInsight } from '@/domains/distillation/use-cases/ReviewKDLInsight'
import { InMemoryKDLInsightRepository } from '@/infrastructure/db/repositories/InMemoryKDLInsightRepository'
import { PrismaKDLInsightRepository } from '@/infrastructure/db/repositories/PrismaKDLInsightRepository'

// Channels - Fase 3.2
import { InMemoryChannelConfigRepository } from '@/infrastructure/db/repositories/InMemoryChannelConfigRepository'
import { PrismaChannelConfigRepository } from '@/infrastructure/db/repositories/PrismaChannelConfigRepository'
import { CreateChannelConfig } from '@/domains/channel/use-cases/CreateChannelConfig'
import { ListChannelConfigs } from '@/domains/channel/use-cases/ListChannelConfigs'
import { DeleteChannelConfig } from '@/domains/channel/use-cases/DeleteChannelConfig'
import { ChannelDispatcherFactory } from '@/infrastructure/channel/ChannelDispatcherFactory'
import { WhatsAppDispatcher } from '@/infrastructure/channel/WhatsAppDispatcher'
import { EmailDispatcher } from '@/infrastructure/channel/EmailDispatcher'
import { WhatsAppWebhookAdapter } from '@/infrastructure/channel/WhatsAppWebhookAdapter'
import { EmailWebhookAdapter } from '@/infrastructure/channel/EmailWebhookAdapter'
// Analytics - Fase 3.4
import { InMemoryAnalyticsRepository } from '@/infrastructure/db/repositories/InMemoryAnalyticsRepository'
import { PrismaAnalyticsRepository } from '@/infrastructure/db/repositories/PrismaAnalyticsRepository'
import { GetOverviewMetrics } from '@/domains/analytics/use-cases/GetOverviewMetrics'
import { GetAgentMetrics } from '@/domains/analytics/use-cases/GetAgentMetrics'

// Harness - Fase 2.2
import { InMemoryInboundEventRepository } from '@/infrastructure/db/repositories/InMemoryInboundEventRepository'
import { InMemoryQueueProvider } from '@/infrastructure/queues/InMemoryQueueProvider'
import { ReceiveInboundEvent } from '@/domains/channel/use-cases/ReceiveInboundEvent'
import { InMemoryTraceRepository } from '@/infrastructure/db/repositories/InMemoryTraceRepository'
import { RecordExecutionTrace } from '@/domains/observability/use-cases/RecordExecutionTrace'
import { InMemoryUsageLimiter } from '@/infrastructure/rate-limit/InMemoryUsageLimiter'
import { ResolveOrCreateContact } from '@/domains/contact/use-cases/ResolveOrCreateContact'
import { InMemoryContactRepository } from '@/infrastructure/db/repositories/InMemoryContactRepository'
import { InMemoryContactChannelIdentityRepository } from '@/infrastructure/db/repositories/InMemoryContactChannelIdentityRepository'
import { InMemoryConversationSummaryRepository } from '@/infrastructure/db/repositories/InMemoryConversationSummaryRepository'
import { InMemoryContactMemoryRepository } from '@/infrastructure/db/repositories/InMemoryContactMemoryRepository'
import { InMemoryConversationLifecycleRepository } from '@/infrastructure/db/repositories/InMemoryConversationLifecycleRepository'
import { ApplyMemoryPolicy } from '@/domains/memory-policy/use-cases/ApplyMemoryPolicy'
import { SummarizeConversation } from '@/domains/memory-policy/use-cases/SummarizeConversation'
import { OrchestrateInboundMessage } from '@/domains/orchestration/use-cases/OrchestrateInboundMessage'
import { ApplyLifecycleTransition } from '@/domains/conversation-lifecycle/use-cases/ApplyLifecycleTransition'
import { RequestHumanHandoff } from '@/domains/conversation-lifecycle/use-cases/RequestHumanHandoff'
import { AcceptHumanHandoff } from '@/domains/conversation-lifecycle/use-cases/AcceptHumanHandoff'

// Prisma Harness Repos
import { PrismaInboundEventRepository } from '@/infrastructure/db/repositories/PrismaInboundEventRepository'
import { PrismaContactRepository } from '@/infrastructure/db/repositories/PrismaContactRepository'
import { PrismaContactChannelIdentityRepository } from '@/infrastructure/db/repositories/PrismaContactChannelIdentityRepository'
import { PrismaConversationLifecycleRepository } from '@/infrastructure/db/repositories/PrismaConversationLifecycleRepository'
import { PrismaTraceRepository } from '@/infrastructure/db/repositories/PrismaTraceRepository'
import { PrismaConversationSummaryRepository } from '@/infrastructure/db/repositories/PrismaConversationSummaryRepository'
import { PrismaContactMemoryRepository } from '@/infrastructure/db/repositories/PrismaContactMemoryRepository'

const usePrisma = !!process.env.DATABASE_URL
const useOpenAI = !!process.env.OPENAI_API_KEY

// ─── Startup guard ────────────────────────────────────────────────────────────
// DATABASE_URL is MANDATORY in all environments except automated tests (Vitest).
// In-memory repos are ONLY allowed when VITEST env var is present (test runner).
// This prevents the silent data-loss scenario where the server starts without a
// DB connection and writes data to volatile memory that disappears on restart.
if (!usePrisma) {
  const isTestEnvironment = !!process.env.VITEST
  const allowInMemory = process.env.ALLOW_INMEMORY === 'true'

  if (!isTestEnvironment && !allowInMemory) {
    throw new Error(
      '\n\n' +
      '╔══════════════════════════════════════════════════════════════╗\n' +
      '║  FATAL: DATABASE_URL is not set                             ║\n' +
      '║                                                              ║\n' +
      '║  All data would be stored in VOLATILE MEMORY and lost       ║\n' +
      '║  every time the server restarts.                             ║\n' +
      '║                                                              ║\n' +
      '║  Fix:                                                        ║\n' +
      '║    1. docker compose up -d   (starts PostgreSQL:5434)        ║\n' +
      '║    2. Restart the dev server                                 ║\n' +
      '║                                                              ║\n' +
      '║  For unit tests only: set VITEST=true (done automatically)  ║\n' +
      '╚══════════════════════════════════════════════════════════════╝\n'
    )
  }
}



const userRepo       = usePrisma ? new PrismaUserRepository()                    : new InMemoryUserRepository()
const tokenRepo      = usePrisma ? new PrismaRefreshTokenRepository()             : new InMemoryRefreshTokenRepository()
const tenantRepo     = usePrisma ? new PrismaTenantRepository()                   : new InMemoryTenantRepository()
const apiKeyRepo     = usePrisma ? new PrismaApiKeyRepository()                   : new InMemoryApiKeyRepository()
const agentRoleRepo  = usePrisma ? new PrismaAgentRoleRepository()                 : new InMemoryAgentRoleRepository()
const agentRepo      = usePrisma ? new PrismaAgentRepository()                    : new InMemoryAgentRepository()
const promptRepo     = usePrisma ? new PrismaAgentPromptVersionRepository()       : new InMemoryAgentPromptVersionRepository()
const knowledgeRepo  = usePrisma ? new PrismaKnowledgeDocumentRepository()        : new InMemoryKnowledgeDocumentRepository()
const vectorRepo         = new InMemoryVectorRepository() // pgvector via SQL raw quando usePrisma (futuro)
const conversationRepo   = usePrisma ? new PrismaConversationRepository() : new InMemoryConversationRepository()
const departmentRepo     = usePrisma ? new PrismaDepartmentRepository()   : new InMemoryDepartmentRepository()
const crewRepo       = usePrisma ? new PrismaCrewRepository()       : new InMemoryCrewRepository()
const crewMemberRepo = usePrisma ? new PrismaCrewMemberRepository()  : new InMemoryCrewMemberRepository()
const qualStateRepo = usePrisma
  ? new PrismaQualificationStateRepository()
  : new InMemoryQualificationStateRepository()

const kdlInsightRepo   = usePrisma ? new PrismaKDLInsightRepository()         : new InMemoryKDLInsightRepository()
const usageLimitRepo   = usePrisma ? new PrismaTenantUsageLimitRepository()   : new InMemoryTenantUsageLimitRepository()
const usageCurrentRepo = usePrisma ? new PrismaTenantUsageCurrentRepository() : new InMemoryTenantUsageCurrentRepository()
const channelConfigRepo = usePrisma ? new PrismaChannelConfigRepository() : new InMemoryChannelConfigRepository()
const analyticsRepo    = usePrisma ? new PrismaAnalyticsRepository() : new InMemoryAnalyticsRepository()

import { InMemoryCrewWorkflowRepository } from '@/infrastructure/db/repositories/InMemoryCrewWorkflowRepository'
import { PrismaCrewWorkflowRepository } from '@/infrastructure/db/repositories/PrismaCrewWorkflowRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'
const crewWorkflowRepo = usePrisma ? new PrismaCrewWorkflowRepository(getPrismaClient()) : new InMemoryCrewWorkflowRepository()

import { LangGraphWorkflowExecutor } from '@/infrastructure/langgraph/LangGraphWorkflowExecutor'
const workflowExecutor = new LangGraphWorkflowExecutor()


// Harness Repos
const inboundEventRepo = usePrisma ? new PrismaInboundEventRepository() : new InMemoryInboundEventRepository()
const queueProvider    = new InMemoryQueueProvider()
const traceRepo        = usePrisma ? new PrismaTraceRepository() : new InMemoryTraceRepository()
const usageLimiter     = new InMemoryUsageLimiter()
const contactRepo      = usePrisma ? new PrismaContactRepository() : new InMemoryContactRepository()
const identityRepo     = usePrisma ? new PrismaContactChannelIdentityRepository() : new InMemoryContactChannelIdentityRepository()
const summaryRepo      = usePrisma ? new PrismaConversationSummaryRepository() : new InMemoryConversationSummaryRepository()
const contactMemoryRepo = usePrisma ? new PrismaContactMemoryRepository() : new InMemoryContactMemoryRepository()
const lifecycleRepo    = usePrisma ? new PrismaConversationLifecycleRepository() : new InMemoryConversationLifecycleRepository()

// ─── Providers ────────────────────────────────────────────────────────────────

const auditLogger       = usePrisma ? new PrismaAuditLogger()       : new ConsoleAuditLogger()
const passwordHasher    = new BcryptPasswordHasher()
const embeddingProvider = useOpenAI ? new OpenAIEmbeddingProvider() : {
  embed: async (_: string) => Array(1536).fill(0),
  embedBatch: async (texts: string[]) => texts.map(() => Array(1536).fill(0)),
}

const llmProvider = useOpenAI ? new OpenAILLMProvider() : {
  complete: async () => ({ content: '[LLM não configurado]', model: 'stub', tokensUsed: 0 }),
}

const extractState = new ExtractAndUpdateState(qualStateRepo, llmProvider)

// ─── Use-cases ────────────────────────────────────────────────────────────────

const receiveInboundEvent = new ReceiveInboundEvent(inboundEventRepo, queueProvider)
const traceRecorder       = new RecordExecutionTrace(traceRepo)
const resolveContact      = new ResolveOrCreateContact(contactRepo, identityRepo)
const memoryPolicy        = new ApplyMemoryPolicy(conversationRepo, summaryRepo, contactMemoryRepo)
const summarizeConversation = new SummarizeConversation(conversationRepo, summaryRepo, llmProvider)
const applyLifecycleTransition = new ApplyLifecycleTransition(conversationRepo, lifecycleRepo)
const requestHumanHandoff = new RequestHumanHandoff(applyLifecycleTransition)
const acceptHumanHandoff = new AcceptHumanHandoff(applyLifecycleTransition)

// Distillation
const runKDL = new RunKDL(kdlInsightRepo, conversationRepo, tenantRepo, llmProvider)
const reviewKDLInsight = new ReviewKDLInsight(kdlInsightRepo, knowledgeRepo)

// Channels
const channelDispatcherFactory = new ChannelDispatcherFactory()
channelDispatcherFactory.register('WHATSAPP', () => new WhatsAppDispatcher(channelConfigRepo))
channelDispatcherFactory.register('EMAIL', () => new EmailDispatcher(channelConfigRepo))

const whatsappWebhookAdapter = new WhatsAppWebhookAdapter({ channelConfigRepo, receiveInboundEvent })
const emailWebhookAdapter = new EmailWebhookAdapter({ channelConfigRepo, receiveInboundEvent })

export const di = {
  // Auth
  authenticateUser:  new AuthenticateUser(userRepo, tokenRepo, auditLogger, passwordHasher),
  refreshSession:    new RefreshSession(tokenRepo, auditLogger, userRepo),
  logoutUser:        new LogoutUser(tokenRepo, auditLogger),
  // Tenant
  createTenant:         new CreateTenant(tenantRepo, userRepo, auditLogger, passwordHasher),
  resolveTenantContext: new ResolveTenantContext(tenantRepo, apiKeyRepo, auditLogger),
  // Agent
  createAgent:       new CreateAgent(agentRepo, promptRepo, agentRoleRepo, auditLogger),
  createAgentRole:   new CreateAgentRole(agentRoleRepo, auditLogger),
  listAgentRoles:    new ListAgentRoles(agentRoleRepo),
  publishAgentPrompt: new PublishAgentPrompt(agentRepo, promptRepo, auditLogger),
  getAgent:          new GetAgent(agentRepo, promptRepo, crewMemberRepo),
  getAgentBySlug:    new GetAgentBySlug(agentRepo, promptRepo),
  listAgents:        new ListAgents(agentRepo, promptRepo, agentRoleRepo),
  updateAgentStatus: new UpdateAgentStatus(agentRepo, auditLogger),
  updateAgent:       new UpdateAgent(agentRepo, auditLogger),
  // Knowledge
  ingestDocument:    new IngestDocument(knowledgeRepo, vectorRepo, embeddingProvider, auditLogger),
  searchKnowledge:   new SearchKnowledge(vectorRepo, embeddingProvider),
  deleteDocument:    new DeleteDocument(knowledgeRepo, vectorRepo, auditLogger),
  listDocuments:     new ListDocuments(knowledgeRepo),
  buildRAGContext:         new BuildRAGContext(agentRepo, promptRepo, vectorRepo, embeddingProvider, llmProvider, auditLogger),
  // Organization
  createDepartment:  new CreateDepartment(departmentRepo, auditLogger),
  listDepartments:   new ListDepartments(departmentRepo),
  getDepartment:     new GetDepartment(departmentRepo),
  updateDepartment:  new UpdateDepartment(departmentRepo, auditLogger),
  deleteDepartment:  new DeleteDepartment(departmentRepo, auditLogger),
  // Crew
  createCrew:          new CreateCrew(crewRepo, departmentRepo, auditLogger),
  listCrews:           new ListCrews(crewRepo),
  getCrew:             new GetCrew(crewRepo, crewMemberRepo),
  getCrewBySlug:       new GetCrewBySlug(crewRepo, crewMemberRepo),
  updateCrew:          new UpdateCrew(crewRepo, auditLogger),
  deleteCrew:          new DeleteCrew(crewRepo, crewMemberRepo, auditLogger),
  addAgentToCrew:      new AddAgentToCrew(crewRepo, crewMemberRepo, agentRepo, auditLogger),
  removeAgentFromCrew: new RemoveAgentFromCrew(crewMemberRepo, auditLogger),
  listCrewMembers:     new ListCrewMembers(crewRepo, crewMemberRepo),
  getCrewMetrics:      new GetCrewMetrics(crewRepo, conversationRepo, auditLogger),
  simulateCrewMessage: null as unknown as SimulateCrewMessage,
  // Conversation
  listConversations:       new ListConversations(conversationRepo),
  getConversationMessages: new GetConversationMessages(conversationRepo),
  getConversationDetails:  new GetConversationDetails(conversationRepo, qualStateRepo, summaryRepo, lifecycleRepo),
  transferConversation:    new TransferConversation(conversationRepo, crewMemberRepo, auditLogger),
  operatorReply:           new OperatorReply(conversationRepo, auditLogger),
  sendMessage:             null as unknown as SendMessage,
  // Usage Limits
  checkUsageLimit: new CheckAndEnforceUsageLimit(usageLimitRepo, usageCurrentRepo),
  recordUsage:     new RecordUsage(usageCurrentRepo, usageLimitRepo),
  updateUsageLimit: new UpdateTenantUsageLimit(usageLimitRepo, auditLogger),
  usageLimitRepo,
  usageCurrentRepo,

  // Harness - Fase 2.2
  receiveInboundEvent,
  traceRecorder,
  usageLimiter,
  resolveContact,
  memoryPolicy,
  summarizeConversation,
  applyLifecycleTransition,
  requestHumanHandoff,
  acceptHumanHandoff,
  orchestrateInboundMessage: null as unknown as OrchestrateInboundMessage,
  // Distillation
  kdlInsightRepo,
  runKDL,
  reviewKDLInsight,

  // Channels
  channelConfigRepo,
  createChannelConfig: new CreateChannelConfig(channelConfigRepo),
  listChannelConfigs: new ListChannelConfigs(channelConfigRepo),
  deleteChannelConfig: new DeleteChannelConfig(channelConfigRepo),
  whatsappWebhookAdapter,
  emailWebhookAdapter,

  // Analytics
  analyticsRepo,
  getOverviewMetrics: new GetOverviewMetrics(analyticsRepo),
  getAgentMetrics: new GetAgentMetrics(analyticsRepo),
}

// SendMessage depende de di.buildRAGContext — resolvido após criação do objeto
di.sendMessage = new SendMessage(
  conversationRepo,
  di.buildRAGContext,
  auditLogger,
  qualStateRepo,
  extractState,
  crewMemberRepo,
  di.transferConversation,
  di.checkUsageLimit,
  di.recordUsage,
)

di.simulateCrewMessage = new SimulateCrewMessage(
  crewRepo,
  crewMemberRepo,
  agentRepo,
  di.sendMessage,
  lifecycleRepo,
  channelConfigRepo,
)

di.orchestrateInboundMessage = new OrchestrateInboundMessage(
  inboundEventRepo,
  conversationRepo,
  resolveContact,
  memoryPolicy,
  usageLimiter,
  traceRecorder,
  di.sendMessage,
  channelDispatcherFactory,
  workflowExecutor,
  crewWorkflowRepo,
)

