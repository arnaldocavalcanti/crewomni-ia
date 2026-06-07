import type { AgentPromptVersion, CreatePromptVersionData } from '../entities/AgentPromptVersion'

export interface IAgentPromptVersionRepository {
  findActiveByAgent(agentId: string, tenantId: string): Promise<AgentPromptVersion | null>
  findLatestByAgent(agentId: string, tenantId: string): Promise<AgentPromptVersion | null>
  getLatestVersion(agentId: string): Promise<number>
  create(data: CreatePromptVersionData): Promise<AgentPromptVersion>
  supersedePrevious(agentId: string, tenantId: string): Promise<void>
}
