'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, type AgentListItem, type ConversationItem } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bot, MessageSquare, Activity, Plus } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'

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
    <div className="p-6 md:p-8 space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Início</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral da sua plataforma</p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button variant="gradient" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Agente
          </Button>
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Agentes ativos
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-blue)]/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-[var(--color-blue)]" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{loading ? '—' : activeAgents}</p>
            <p className="text-xs text-muted-foreground mt-1">{loading ? '' : `${agents.length} total`}</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Conversas abertas
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-purple)]/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-[var(--color-purple)]" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{loading ? '—' : openConversations}</p>
            <p className="text-xs text-muted-foreground mt-1">{loading ? '' : `${conversations.length} recentes`}</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status da plataforma
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-sm font-semibold text-foreground">Operacional</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent agents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Agentes recentes</h2>
          <Link href="/dashboard/agents" className="text-xs text-[var(--color-blue)] hover:underline font-medium">
            Ver todos
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="Nenhum agente ainda"
            description="Crie seu primeiro agente de IA para começar a automatizar tarefas."
            actionLabel="+ Criar agente"
            actionHref="/dashboard/agents/new"
          />
        ) : (
          <div className="space-y-2">
            {agents.slice(0, 5).map(agent => (
              <Link key={agent.id} href={`/dashboard/agents/${agent.id}`}>
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border hover:border-[var(--color-blue)]/30 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-primary/10 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-[var(--color-blue)]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{agent.name}</p>
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
