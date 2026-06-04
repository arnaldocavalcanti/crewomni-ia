import { AuthenticateUser } from '@/domains/auth/use-cases/AuthenticateUser'
import { RefreshSession } from '@/domains/auth/use-cases/RefreshSession'
import { LogoutUser } from '@/domains/auth/use-cases/LogoutUser'
import { CreateTenant } from '@/domains/tenant/use-cases/CreateTenant'
import { ResolveTenantContext } from '@/domains/tenant/use-cases/ResolveTenantContext'
import { CreateAgent } from '@/domains/agent/use-cases/CreateAgent'
import { PublishAgentPrompt } from '@/domains/agent/use-cases/PublishAgentPrompt'
import { GetAgent } from '@/domains/agent/use-cases/GetAgent'
import { ListAgents } from '@/domains/agent/use-cases/ListAgents'
import { UpdateAgentStatus } from '@/domains/agent/use-cases/UpdateAgentStatus'
import { IngestDocument } from '@/domains/knowledge/use-cases/IngestDocument'
import { SearchKnowledge } from '@/domains/knowledge/use-cases/SearchKnowledge'
import { DeleteDocument } from '@/domains/knowledge/use-cases/DeleteDocument'
import { BcryptPasswordHasher } from '@/infrastructure/auth/BcryptPasswordHasher'
import { ConsoleAuditLogger } from '@/infrastructure/audit/ConsoleAuditLogger'
import { PrismaAuditLogger } from '@/infrastructure/audit/PrismaAuditLogger'
import { InMemoryUserRepository } from '@/infrastructure/db/repositories/InMemoryUserRepository'
import { InMemoryRefreshTokenRepository } from '@/infrastructure/db/repositories/InMemoryRefreshTokenRepository'
import { InMemoryTenantRepository } from '@/infrastructure/db/repositories/InMemoryTenantRepository'
import { InMemoryApiKeyRepository } from '@/infrastructure/db/repositories/InMemoryApiKeyRepository'
import { InMemoryAgentRepository } from '@/infrastructure/db/repositories/InMemoryAgentRepository'
import { InMemoryAgentPromptVersionRepository } from '@/infrastructure/db/repositories/InMemoryAgentPromptVersionRepository'
import { InMemoryKnowledgeDocumentRepository } from '@/infrastructure/db/repositories/InMemoryKnowledgeDocumentRepository'
import { InMemoryVectorRepository } from '@/infrastructure/vector/InMemoryVectorRepository'
import { PrismaUserRepository } from '@/infrastructure/db/repositories/PrismaUserRepository'
import { PrismaRefreshTokenRepository } from '@/infrastructure/db/repositories/PrismaRefreshTokenRepository'
import { PrismaTenantRepository } from '@/infrastructure/db/repositories/PrismaTenantRepository'
import { PrismaApiKeyRepository } from '@/infrastructure/db/repositories/PrismaApiKeyRepository'
import { PrismaAgentRepository } from '@/infrastructure/db/repositories/PrismaAgentRepository'
import { PrismaAgentPromptVersionRepository } from '@/infrastructure/db/repositories/PrismaAgentPromptVersionRepository'
import { PrismaKnowledgeDocumentRepository } from '@/infrastructure/db/repositories/PrismaKnowledgeDocumentRepository'
import { OpenAIEmbeddingProvider } from '@/infrastructure/llm/openai/OpenAIEmbeddingProvider'
import { OpenAILLMProvider } from '@/infrastructure/llm/openai/OpenAILLMProvider'
import { BuildRAGContext } from '@/domains/knowledge/use-cases/BuildRAGContext'
import { SendMessage } from '@/domains/conversation/use-cases/SendMessage'
import { ListConversations } from '@/domains/conversation/use-cases/ListConversations'
import { GetConversationMessages } from '@/domains/conversation/use-cases/GetConversationMessages'
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
import { InMemoryCrewRepository } from '@/infrastructure/db/repositories/InMemoryCrewRepository'
import { InMemoryCrewMemberRepository } from '@/infrastructure/db/repositories/InMemoryCrewMemberRepository'
import { PrismaCrewRepository } from '@/infrastructure/db/repositories/PrismaCrewRepository'
import { PrismaCrewMemberRepository } from '@/infrastructure/db/repositories/PrismaCrewMemberRepository'

const usePrisma = !!process.env.DATABASE_URL
const useOpenAI = !!process.env.OPENAI_API_KEY

// ─── Repositories ─────────────────────────────────────────────────────────────

const userRepo       = usePrisma ? new PrismaUserRepository()                    : new InMemoryUserRepository()
const tokenRepo      = usePrisma ? new PrismaRefreshTokenRepository()             : new InMemoryRefreshTokenRepository()
const tenantRepo     = usePrisma ? new PrismaTenantRepository()                   : new InMemoryTenantRepository()
const apiKeyRepo     = usePrisma ? new PrismaApiKeyRepository()                   : new InMemoryApiKeyRepository()
const agentRepo      = usePrisma ? new PrismaAgentRepository()                    : new InMemoryAgentRepository()
const promptRepo     = usePrisma ? new PrismaAgentPromptVersionRepository()       : new InMemoryAgentPromptVersionRepository()
const knowledgeRepo  = usePrisma ? new PrismaKnowledgeDocumentRepository()        : new InMemoryKnowledgeDocumentRepository()
const vectorRepo         = new InMemoryVectorRepository() // pgvector via SQL raw quando usePrisma (futuro)
const conversationRepo   = usePrisma ? new PrismaConversationRepository() : new InMemoryConversationRepository()
const departmentRepo     = usePrisma ? new PrismaDepartmentRepository()   : new InMemoryDepartmentRepository()
const crewRepo       = usePrisma ? new PrismaCrewRepository()       : new InMemoryCrewRepository()
const crewMemberRepo = usePrisma ? new PrismaCrewMemberRepository()  : new InMemoryCrewMemberRepository()

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

// ─── Use-cases ────────────────────────────────────────────────────────────────

export const di = {
  // Auth
  authenticateUser:  new AuthenticateUser(userRepo, tokenRepo, auditLogger, passwordHasher),
  refreshSession:    new RefreshSession(tokenRepo, auditLogger),
  logoutUser:        new LogoutUser(tokenRepo, auditLogger),
  // Tenant
  createTenant:         new CreateTenant(tenantRepo, userRepo, auditLogger, passwordHasher),
  resolveTenantContext: new ResolveTenantContext(tenantRepo, apiKeyRepo, auditLogger),
  // Agent
  createAgent:       new CreateAgent(agentRepo, promptRepo, auditLogger),
  publishAgentPrompt: new PublishAgentPrompt(agentRepo, promptRepo, auditLogger),
  getAgent:          new GetAgent(agentRepo, promptRepo),
  getAgentBySlug:    new GetAgentBySlug(agentRepo, promptRepo),
  listAgents:        new ListAgents(agentRepo, promptRepo),
  updateAgentStatus: new UpdateAgentStatus(agentRepo, auditLogger),
  // Knowledge
  ingestDocument:    new IngestDocument(knowledgeRepo, vectorRepo, embeddingProvider, auditLogger),
  searchKnowledge:   new SearchKnowledge(vectorRepo, embeddingProvider),
  deleteDocument:    new DeleteDocument(knowledgeRepo, vectorRepo, auditLogger),
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
  updateCrew:          new UpdateCrew(crewRepo, auditLogger),
  deleteCrew:          new DeleteCrew(crewRepo, crewMemberRepo, auditLogger),
  addAgentToCrew:      new AddAgentToCrew(crewRepo, crewMemberRepo, agentRepo, auditLogger),
  removeAgentFromCrew: new RemoveAgentFromCrew(crewMemberRepo, auditLogger),
  listCrewMembers:     new ListCrewMembers(crewRepo, crewMemberRepo),
  // Conversation
  listConversations:       new ListConversations(conversationRepo),
  getConversationMessages: new GetConversationMessages(conversationRepo),
  sendMessage:             null as unknown as SendMessage,
}

// SendMessage depende de di.buildRAGContext — resolvido após criação do objeto
di.sendMessage = new SendMessage(conversationRepo, di.buildRAGContext, auditLogger)
