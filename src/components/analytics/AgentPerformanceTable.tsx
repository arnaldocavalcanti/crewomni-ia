'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface AgentPerformance {
  agentId: string
  name: string
  conversationsHandled: number
  avgTokensPerConversation: number
  handoffRate: number
}

interface AgentPerformanceTableProps {
  agents: AgentPerformance[] | null
  isLoading: boolean
}

export function AgentPerformanceTable({ agents, isLoading }: AgentPerformanceTableProps) {
  if (isLoading || !agents) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance por Agente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance por Agente</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agente</TableHead>
              <TableHead className="text-right">Conversas Atendidas</TableHead>
              <TableHead className="text-right">Taxa de Handoff</TableHead>
              <TableHead className="text-right">Média de Tokens/Conv</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.agentId}>
                <TableCell className="font-medium">{agent.name}</TableCell>
                <TableCell className="text-right">{agent.conversationsHandled}</TableCell>
                <TableCell className="text-right">{(agent.handoffRate * 100).toFixed(1)}%</TableCell>
                <TableCell className="text-right">{agent.avgTokensPerConversation.toFixed(0)}</TableCell>
              </TableRow>
            ))}
            {agents.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                  Nenhum dado encontrado no período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
