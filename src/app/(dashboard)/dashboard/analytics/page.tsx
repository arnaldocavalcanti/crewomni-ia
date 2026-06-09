'use client'

import React, { useState, useEffect } from 'react'
import { OverviewCards } from '@/components/analytics/OverviewCards'
import { AgentPerformanceTable } from '@/components/analytics/AgentPerformanceTable'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d')
  const [overview, setOverview] = useState(null)
  const [agents, setAgents] = useState(null)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [loadingAgents, setLoadingAgents] = useState(true)

  useEffect(() => {
    async function fetchOverview() {
      setLoadingOverview(true)
      try {
        const data = await api.analytics.getOverview(timeRange)
        setOverview(data)
      } catch (e) {
        console.error('Error fetching overview', e)
      } finally {
        setLoadingOverview(false)
      }
    }

    async function fetchAgents() {
      setLoadingAgents(true)
      try {
        const data = await api.analytics.getAgents(timeRange)
        setAgents(data)
      } catch (e) {
        console.error('Error fetching agents', e)
      } finally {
        setLoadingAgents(false)
      }
    }

    fetchOverview()
    fetchAgents()
  }, [timeRange])

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Analytics Avançado</h2>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={(val) => setTimeRange(val ?? '7d')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="15d">Últimos 15 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <OverviewCards metrics={overview} isLoading={loadingOverview} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-4">
        <div className="col-span-7">
          <AgentPerformanceTable agents={agents} isLoading={loadingAgents} />
        </div>
      </div>
    </div>
  )
}
