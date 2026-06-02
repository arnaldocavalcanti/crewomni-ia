'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, type AgentListItem, type ConversationItem } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bot, MessageSquare, Activity } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'

export default function DashboardHome() {
  const [agents, setAgents] = useState<AgentListItem[]>([])
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.agents.list(), api.conversations.list(undefined, 1)])
      .then(([a, c]) => { setAgents(a); setConversations(c.conversations) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const activeAgents = agents.filter(a => a.status === 'ACTIVE').length
  const openConversations = conversations.filter(c => c.status === 'OPEN').length

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Início</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da sua conta</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agentes ativos</CardTitle>
            <Bot className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{loading ? '—' : activeAgents}</p>
            <p className="text-xs text-muted-foreground mt-1">{loading ? '' : `${agents.length} total`}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversas abertas</CardTitle>
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{loading ? '—' : openConversations}</p>
            <p className="text-xs text-muted-foreground mt-1">{loading ? '' : `${conversations.length} recentes`}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status da plataforma</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-sm font-medium text-foreground">Operacional</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent agents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Agentes recentes</h2>
          <Link href="/dashboard/agents" className="text-xs text-primary hover:underline">Ver todos</Link>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum agente criado ainda.</p>
        ) : (
          <div className="space-y-2">
            {agents.slice(0, 5).map(agent => (
              <Link key={agent.id} href={`/dashboard/agents/${agent.id}`}>
                <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.type}</p>
                    </div>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
