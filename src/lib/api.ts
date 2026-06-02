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
    publishPrompt: (id: string, systemPrompt: string) =>
      request(`/agents/${id}/prompt`, { method: 'PATCH', body: JSON.stringify({ systemPrompt }) }),
    updateStatus: (id: string, status: string) =>
      request(`/agents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },

  // ─── Conversations ─────────────────────────────────────────────────────────

  conversations: {
    list: (agentId?: string, page = 1) => {
      const q = new URLSearchParams({ page: String(page), ...(agentId ? { agentId } : {}) })
      return request<ConversationsListOutput>(`/conversations?${q}`)
    },
    getMessages: (id: string) => request<ConversationDetail>(`/conversations/${id}/messages`),
    sendMessage: (payload: SendMessagePayload) =>
      request<SendMessageOutput>('/conversations/message', { method: 'POST', body: JSON.stringify(payload) }),
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
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentListItem = {
  id: string; tenantId: string; name: string; slug: string
  type: string; description: string | null; status: string
  createdAt: string; updatedAt: string
}

export type AgentDetail = AgentListItem & {
  activePromptVersion: { id: string; systemPrompt: string; version: number; status: string } | null
}

export type CreateAgentPayload = { name: string; type: string; description?: string; systemPrompt: string }

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
