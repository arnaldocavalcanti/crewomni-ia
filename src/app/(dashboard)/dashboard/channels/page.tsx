'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ChannelsClient } from './ChannelsClient'

export default function ChannelsPage() {
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.channels.list()
      .then(setChannels)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Canais de Atendimento</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Integre o WhatsApp e E-mail para que seus agentes omnicanal possam responder clientes automaticamente.
          </p>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="h-32 rounded-xl border border-border bg-secondary/30 animate-pulse" />
            <div className="h-32 rounded-xl border border-border bg-secondary/30 animate-pulse" />
          </div>
        ) : (
          <ChannelsClient initialChannels={channels} />
        )}
      </main>
    </div>
  )
}
