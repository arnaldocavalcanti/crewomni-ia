'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ChannelsClient } from './ChannelsClient'

export default function ChannelsPage() {
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    setFetchError(null)
    api.channels.list()
      .then(setChannels)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        setFetchError(msg)
      })
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
        ) : fetchError ? (
          <div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 space-y-1">
            <p className="font-medium">Não foi possível carregar os canais.</p>
            <p className="font-mono text-xs opacity-80">{fetchError}</p>
          </div>
        ) : (
          <ChannelsClient initialChannels={channels} />
        )}
      </main>
    </div>
  )
}
