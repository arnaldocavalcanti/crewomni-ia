'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, type ConversationDetail, type MessageItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { ArrowLeft, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.conversations.getMessages(id)
      .then(setData)
      .catch(() => router.push('/dashboard/conversations'))
      .finally(() => setLoading(false))
  }, [id, router])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Carregando…</p>
    </div>
  )

  if (!data) return null

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/conversations">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground truncate">
              Conversa {data.conversationId.slice(0, 8)}…
            </h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.messages.length} mensagem{data.messages.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {data.messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem.</p>
        )}
        {data.messages.map((msg: MessageItem) => (
          <div key={msg.id} className={cn('flex gap-3', msg.role === 'USER' && 'flex-row-reverse')}>
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
              msg.role === 'USER' ? 'bg-primary/20' : 'bg-card border border-border'
            )}>
              {msg.role === 'USER'
                ? <User className="w-3.5 h-3.5 text-primary" />
                : <Bot className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </div>
            <div className={cn(
              'max-w-[85%] space-y-1',
              msg.role === 'USER' ? 'items-end' : 'items-start'
            )}>
              <div className={cn(
                'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                msg.role === 'USER'
                  ? 'bg-primary text-white rounded-tr-sm'
                  : msg.metadata?.failed
                    ? 'bg-red-950 text-red-300 border border-red-800 rounded-tl-sm'
                    : 'bg-card border border-border text-foreground rounded-tl-sm'
              )}>
                {msg.content}
              </div>
              <div className={cn(
                'flex items-center gap-2 px-1',
                msg.role === 'USER' ? 'justify-end' : 'justify-start'
              )}>
                <span className="text-xs text-muted-foreground">
                  {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'ASSISTANT' && msg.metadata?.model && (
                  <span className="text-xs text-muted-foreground">
                    · {msg.metadata.model} · {msg.metadata.tokensUsed}t
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
