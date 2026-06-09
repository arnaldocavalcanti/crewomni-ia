'use client'

import { getAccessToken, setAccessToken, clearAccessToken } from './auth'

const BASE = '/api/v1'

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    if (!res.ok) return false
    const data = await res.json()
    setAccessToken(data.accessToken)
    return true
  } catch {
    return false
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  }

  let res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    const refreshed = await refreshToken()
    if (refreshed) {
      const newToken = getAccessToken()
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${BASE}${path}`, { ...options, headers })
    } else {
      clearAccessToken()
      window.location.href = '/login'
      throw new Error('Session expired')
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Erro desconhecido' }))
    throw new ApiError(err.code ?? 'UNKNOWN', err.message ?? 'Erro desconhecido', res.status)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message)
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ accessToken: string; user: { id: string; name: string; email: string; role: string; tenantId: string | null } }>(
        '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
      ),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },

  // ─── Agents ────────────────────────────────────────────────────────────────

  agents: {
    list: () => request<AgentListItem[]>('/agents'),
    get: (id: string) => request<AgentDetail>(`/agents/${id}`),
    create: (data: CreateAgentPayload) =>
      request<AgentListItem>('/agents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateAgentPayload>) =>
      request<AgentDetail>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    publishPrompt: (id: string, systemPrompt: string) =>
      request(`/agents/${id}/prompt`, { method: 'PATCH', body: JSON.stringify({ systemPrompt }) }),
    updateStatus: (id: string, status: string) =>
      request(`/agents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    roles: {
      list: () => request<AgentRoleItem[]>('/agents/roles'),
      create: (data: { name: string; category: string; description?: string }) =>
        request<AgentRoleItem>('/agents/roles', { method: 'POST', body: JSON.stringify(data) }),
    },
  },

  // ─── Conversations ─────────────────────────────────────────────────────────

  conversations: {
    list: (agentId?: string, page = 1) => {
      const q = new URLSearchParams({ page: String(page), ...(agentId ? { agentId } : {}) })
      return request<ConversationsListOutput>(`/conversations?${q}`)
    },
    getMessages: (id: string) => request<ConversationDetail>(`/conversations/${id}/messages`),
    getDetails: (id: string) => request<ConversationDetailsOutput>(`/conversations/${id}`),
    sendMessage: (payload: SendMessagePayload) =>
      request<SendMessageOutput>('/conversations/message', { method: 'POST', body: JSON.stringify(payload) }),
    requestHandoff: (id: string, reason: string) =>
      request<HandoffActionOutput>(`/conversations/${id}/request-handoff`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    acceptHandoff: (id: string) =>
      request<HandoffActionOutput>(`/conversations/${id}/accept-handoff`, { method: 'POST' }),
    close: (id: string, reason?: string) =>
      request<{ success: boolean; status: string }>(`/conversations/${id}/close`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    reply: (id: string, content: string) =>
      request<{ messageId: string; content: string; createdAt: Date }>(`/conversations/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
  },

  // ─── Knowledge ────────────────────────────────────────────────────────────

  knowledge: {
    list: (agentId?: string) => {
      const q = agentId ? `?agentId=${agentId}` : ''
      return request<{ documents: KnowledgeDocumentItem[] }>(`/knowledge${q}`)
    },
    ingest: (data: IngestDocumentPayload) =>
      request<KnowledgeDocumentItem>('/knowledge', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/knowledge/${id}`, { method: 'DELETE' }),
    parseYoutube: (url: string) =>
      request<{ title: string; content: string; videoId: string }>(
        '/knowledge/parse-youtube', { method: 'POST', body: JSON.stringify({ url }) },
      ),
    parseFile: async (file: File): Promise<{ title: string; content: string }> => {
      const token = getAccessToken()
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${BASE}/knowledge/parse-file`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro ao processar arquivo' }))
        throw new ApiError(err.code ?? 'UNKNOWN', err.message ?? 'Erro ao processar arquivo', res.status)
      }
      return res.json()
    },
  },

  // ─── Departments ──────────────────────────────────────────────────────────

  departments: {
    list: () => request<DepartmentItem[]>('/departments'),
    get: (id: string) => request<DepartmentItem>(`/departments/${id}`),
    create: (data: CreateDepartmentPayload) =>
      request<DepartmentItem>('/departments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: UpdateDepartmentPayload) =>
      request<DepartmentItem>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/departments/${id}`, { method: 'DELETE' }),
  },

  // ─── Crews ────────────────────────────────────────────────────────────────

  crews: {
    list: () => request<CrewItem[]>('/crews'),
    get: (id: string) => request<{ crew: CrewItem, members: any[] }>(`/crews/${id}`),
    create: (data: CreateCrewPayload) =>
      request<CrewItem>('/crews', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: UpdateCrewPayload) =>
      request<CrewItem>(`/crews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/crews/${id}`, { method: 'DELETE' }),
    getMetrics: (id: string) =>
      request<CrewMetricsOutput>(`/crews/${id}/metrics`),
    addMember: (crewId: string, data: { agentId: string; role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'; order: number; isRequired?: boolean }) =>
      request<any>(`/crews/${crewId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  },

  // ─── Channels ──────────────────────────────────────────────────────────────

  channels: {
    list: () => request<any[]>('/channels'),
    create: (data: {
      provider: 'WHATSAPP' | 'EMAIL'
      phoneNumberId?: string | null
      accessToken?: string | null
      webhookSecret?: string | null
      fromAddress?: string | null
      fromName?: string | null
      sendgridApiKey?: string | null
    }) => request<any>('/channels', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/channels/${id}`, { method: 'DELETE' }),
  },

  // ─── Analytics ─────────────────────────────────────────────────────────────

  analytics: {
    getOverview: (timeRange: string) => request<any>(`/analytics/overview?timeRange=${timeRange}`),
    getAgents: (timeRange: string) => request<any>(`/analytics/agents?timeRange=${timeRange}`),
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentRoleItem = {
  id: string
  tenantId: string | null
  name: string
  category: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export type AgentListItem = {
  id: string; tenantId: string; name: string; slug: string
  type: string; description: string | null; status: string
  category: string; roleId: string; operationalFunction: string
  createdAt: string; updatedAt: string
}

export type AgentDetail = AgentListItem & {
  activePromptVersion: { id: string; systemPrompt: string; version: number; status: string } | null
  // Extended fields
  directorId: string | null
  mainChannel: string | null
  toneOfVoice: string | null
  communicationStyle: string | null
  autonomyLevel: string | null
  responsibilities: string[]
  permissionReadKB: boolean
  permissionSendWhatsapp: boolean
  permissionSendEmail: boolean
  permissionExecuteTool: boolean
  permissionCallHuman: boolean
  permissionCreateTask: boolean
  permissionReadHistory: boolean
  permissionReadCommercial: boolean
  outputFormat: string | null
  expectedExamples: string | null
  specificRules: string | null
}

export type CreateAgentPayload = {
  name: string
  category: string
  roleId: string
  operationalFunction: string
  description?: string
  systemPrompt: string
  directorId?: string | null
  mainChannel?: string | null
  toneOfVoice?: string | null
  communicationStyle?: string | null
  autonomyLevel?: string | null
  responsibilities?: string[]
  permissionReadKB?: boolean
  permissionSendWhatsapp?: boolean
  permissionSendEmail?: boolean
  permissionExecuteTool?: boolean
  permissionCallHuman?: boolean
  permissionCreateTask?: boolean
  permissionReadHistory?: boolean
  permissionReadCommercial?: boolean
  outputFormat?: string | null
  expectedExamples?: string | null
  specificRules?: string | null
}

export type ConversationsListOutput = {
  conversations: ConversationItem[]; total: number; page: number
}

export type ConversationItem = {
  id: string; agentId: string; externalUserId: string | null
  status: string; messageCount: number; createdAt: string; updatedAt: string
}

export type ConversationDetail = {
  conversationId: string; agentId: string; status: string
  messages: MessageItem[]
}

export type MessageItem = {
  id: string; role: string; content: string
  metadata: { model?: string; tokensUsed?: number; failed?: boolean } | null
  createdAt: string
}

export type QualificationState = {
  leadScore: number | null
  intent: string | null
  sentiment: string | null
  qualificationStatus: string | null
  extractedData: Record<string, unknown>
  updatedAt: string
}

export type LifecycleEvent = {
  id: string
  fromStatus: string
  toStatus: string
  actor: string
  actorId: string | null
  reason: string | null
  createdAt: string
}

export type ConversationDetailsOutput = {
  conversationId: string
  agentId: string
  externalUserId: string | null
  status: string
  messages: MessageItem[]
  qualificationState: QualificationState | null
  lifecycleEvents: LifecycleEvent[]
  summary: string | null
  createdAt: string
  updatedAt: string
}

export type HandoffActionOutput = {
  conversationId: string
  previousStatus: string
  currentStatus: string
  eventId: string
}

export type SendMessagePayload = {
  agentId: string; message: string; conversationId?: string; externalUserId?: string
}

export type SendMessageOutput = {
  conversationId: string; messageId: string; reply: string
  model: string; tokensUsed: number; isNewConversation: boolean
}

export type DepartmentItem = {
  id: string; tenantId: string; name: string; slug: string
  description: string | null; status: 'ACTIVE' | 'INACTIVE'
  createdAt: string; updatedAt: string
}

export type CreateDepartmentPayload = { name: string; description?: string }
export type UpdateDepartmentPayload = { name?: string; description?: string; status?: 'ACTIVE' | 'INACTIVE' }

export type KnowledgeDocumentItem = {
  id: string; tenantId: string | null; agentId: string | null
  layer: 'GLOBAL' | 'INDUSTRY' | 'TENANT' | 'AGENT'
  title: string; content: string; status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
  chunksCount: number; createdAt: string; updatedAt: string
}
export type IngestDocumentPayload = { title: string; content: string; layer: 'TENANT' | 'AGENT'; agentId?: string }

export type CrewItem = {
  id: string; tenantId: string; departmentId: string | null; name: string; slug: string
  objective: string | null; description: string | null; status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  createdAt: string; updatedAt: string
}

export type CreateCrewPayload = { name: string; departmentId?: string; objective?: string; description?: string }
export type UpdateCrewPayload = { name?: string; objective?: string; description?: string; status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' }

export type CrewMetricsOutput = {
  totalConversations: number; activeConversations: number; totalMessages: number
  messagesByAgent: { agentId: string; count: number }[]
}
