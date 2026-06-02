'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, type AgentListItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Bot, Plus } from 'lucide-react'

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.agents.list().then(setAgents).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agentes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus agentes de IA</p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo agente
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 border border-dashed border-border rounded-xl">
          <Bot className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum agente criado ainda</p>
          <Link href="/dashboard/agents/new">
            <Button size="sm" variant="outline">Criar primeiro agente</Button>
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Nome</TableHead>
                <TableHead className="text-muted-foreground font-medium">Tipo</TableHead>
                <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                <TableHead className="text-muted-foreground font-medium">Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map(agent => (
                <TableRow key={agent.id} className="border-border hover:bg-secondary/50 cursor-pointer">
                  <TableCell>
                    <Link href={`/dashboard/agents/${agent.id}`} className="flex items-center gap-3 group">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {agent.name}
                        </p>
                        {agent.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{agent.description}</p>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{agent.type}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={agent.status} /></TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(agent.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
