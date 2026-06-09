'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, MessageSquare, Bot, AlertTriangle } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface OverviewMetrics {
  totalConversations: number
  totalMessages: number
  totalTokens: number
  handoffRate: number
  sparklines: {
    conversations: number[]
  }
}

interface OverviewCardsProps {
  metrics: OverviewMetrics | null
  isLoading: boolean
}

export function OverviewCards({ metrics, isLoading }: OverviewCardsProps) {
  if (isLoading || !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded"></div>
              <div className="h-4 w-4 bg-muted rounded-full"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded mb-2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const sparklineData = metrics.sparklines.conversations.map((v, i) => ({ value: v, index: i }))

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalConversations}</div>
          <div className="h-[40px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line type="monotone" dataKey="value" stroke="var(--color-blue)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mensagens</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalMessages}</div>
          <p className="text-xs text-muted-foreground mt-1">Total trocado no período</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tokens Consumidos</CardTitle>
          <Bot className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(metrics.totalTokens / 1000).toFixed(1)}k</div>
          <p className="text-xs text-muted-foreground mt-1">Estimativa de uso de LLM</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Handoff</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(metrics.handoffRate * 100).toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground mt-1">Conversas enviadas p/ humanos</p>
        </CardContent>
      </Card>
    </div>
  )
}
