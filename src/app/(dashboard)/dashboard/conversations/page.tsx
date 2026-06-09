'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  api,
  type ConversationItem,
  type ConversationDetailsOutput,
  type MessageItem,
  type LifecycleEvent,
} from '@/lib/api'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  MessageSquare,
  Bot,
  User,
  RefreshCw,
  UserCheck,
  PhoneCall,
  X,
  ChevronRight,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle2,
  Send,
} from 'lucide-react'

// ─── Status filter tabs ────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { label: 'Todas', value: '' },
  { label: 'Abertas', value: 'OPEN' },
  { label: 'Handoff', value: 'HANDOFF_REQUESTED' },
  { label: 'Em Atendimento', value: 'HANDOFF_ACCEPTED' },
  { label: 'Encerradas', value: 'CLOSED' },
]

// ─── Helper: human-readable time diff ─────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'agora'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

// ─── Conversation list item ────────────────────────────────────────────────────

function ConvListItem({
  conv,
  selected,
  onClick,
}: {
  conv: ConversationItem
  selected: boolean
  onClick: () => void
}) {
  const isHandoff = conv.status === 'HANDOFF_REQUESTED'
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3.5 border-b border-border transition-all duration-150 flex items-start gap-3 group',
        selected
          ? 'bg-accent/60 border-l-2 border-l-[var(--color-blue)]'
          : 'hover:bg-muted/50 border-l-2 border-l-transparent',
        isHandoff && !selected && 'bg-orange-50/60 dark:bg-orange-950/20',
      )}
    >
      {/* Avatar / status dot */}
      <div className="relative mt-0.5 flex-shrink-0">
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center',
          selected ? 'bg-gradient-primary text-white' : 'bg-muted text-muted-foreground',
        )}>
          <MessageSquare className="w-4 h-4" />
        </div>
        {isHandoff && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-orange-500 border-2 border-background animate-pulse" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-sm font-medium truncate',
            selected ? 'text-foreground' : 'text-foreground/80',
          )}>
            {conv.externalUserId ?? `#${conv.id.slice(0, 8)}`}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(conv.updatedAt)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <StatusBadge status={conv.status} />
          <span className="text-xs text-muted-foreground">{conv.messageCount} msgs</span>
        </div>
      </div>

      <ChevronRight className={cn(
        'w-4 h-4 text-muted-foreground flex-shrink-0 mt-2 transition-transform',
        selected ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-60',
      )} />
    </button>
  )
}

// ─── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: MessageItem }) {
  const isUser = msg.role === 'USER'
  const isOperator = msg.role === 'OPERATOR'
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isUser ? 'bg-gradient-primary text-white' : 
        isOperator ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' : 'bg-card border border-border',
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5" />
          : isOperator ? <UserCheck className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      <div className={cn('max-w-[75%] space-y-1', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
          isUser
            ? 'bg-gradient-primary text-white rounded-tr-sm'
            : isOperator
              ? 'bg-violet-50 text-violet-900 border border-violet-200 rounded-tl-sm dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-800'
              : msg.metadata?.failed
                ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-sm dark:bg-red-950 dark:text-red-300 dark:border-red-800'
                : 'bg-card border border-border text-foreground rounded-tl-sm',
        )}>
          {msg.content}
        </div>
        <div className={cn(
          'flex items-center gap-2 px-1',
          isUser ? 'justify-end' : 'justify-start',
        )}>
          <span className="text-xs text-muted-foreground">
            {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOperator && (
            <span className="text-xs text-muted-foreground font-medium">· Operador</span>
          )}
          {!isUser && !isOperator && msg.metadata?.model && (
            <span className="text-xs text-muted-foreground">
              · {msg.metadata.model} · {msg.metadata.tokensUsed}t
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Lifecycle timeline ────────────────────────────────────────────────────────

function LifecycleTimeline({ events }: { events: LifecycleEvent[] }) {
  if (!events.length) return null
  return (
    <div className="space-y-1">
      {[...events].reverse().map((ev, i) => (
        <div key={ev.id} className={cn('flex items-start gap-2 text-xs', i > 0 && 'opacity-50')}>
          <div className={cn(
            'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
            i === 0 ? 'bg-[var(--color-blue)]' : 'bg-muted-foreground',
          )} />
          <div className="flex-1 min-w-0">
            <span className="text-foreground font-medium">{ev.fromStatus} → {ev.toStatus}</span>
            {ev.reason && <span className="text-muted-foreground ml-1">· {ev.reason}</span>}
          </div>
          <span className="text-muted-foreground flex-shrink-0">
            {new Date(ev.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Action buttons panel ──────────────────────────────────────────────────────

function ActionPanel({
  status,
  conversationId,
  onStatusChange,
}: {
  status: string
  conversationId: string
  onStatusChange: (newStatus: string) => void
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handle(action: string, fn: () => Promise<{ currentStatus?: string; status?: string }>) {
    setLoading(action)
    setError(null)
    try {
      const res = await fn()
      onStatusChange(res.currentStatus ?? res.status ?? status)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao executar ação')
    } finally {
      setLoading(null)
    }
  }

  const isClosed = status === 'CLOSED' || status === 'ARCHIVED'
  if (isClosed) return (
    <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 rounded-xl border border-border">
      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Conversa encerrada</span>
    </div>
  )

  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 dark:bg-red-950/50 dark:border-red-800 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'HANDOFF_REQUESTED' && (
          <Button
            variant="gradient"
            size="sm"
            disabled={!!loading}
            onClick={() => handle('accept', () => api.conversations.acceptHandoff(conversationId))}
          >
            {loading === 'accept' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            Aceitar Atendimento
          </Button>
        )}

        {(status === 'OPEN' || status === 'ACTIVE' || status === 'WAITING_USER' || status === 'WAITING_AGENT') && (
          <Button
            variant="outline"
            size="sm"
            disabled={!!loading}
            onClick={() => handle('request', () => api.conversations.requestHandoff(conversationId, 'Solicitado pelo operador'))}
          >
            {loading === 'request' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
            Solicitar Handoff
          </Button>
        )}

        {status !== 'CLOSED' && status !== 'ARCHIVED' && (
          <Button
            variant="destructive"
            size="sm"
            disabled={!!loading}
            onClick={() => handle('close', () => api.conversations.close(conversationId))}
          >
            {loading === 'close' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            Encerrar
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  conversationId,
  onClose,
}: {
  conversationId: string
  onClose: () => void
}) {
  const [data, setData] = useState<ConversationDetailsOutput | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'messages' | 'lifecycle' | 'qualification'>('messages')
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.conversations.getDetails(conversationId)
      setData(d)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const es = new EventSource('/api/v1/realtime')
    
    const handleEvent = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data)
        if (payload.conversationId === conversationId) {
          load()
        }
      } catch (err) { }
    }

    es.addEventListener('MESSAGE_RECEIVED', handleEvent)
    es.addEventListener('MESSAGE_SENT', handleEvent)
    es.addEventListener('LIFECYCLE_CHANGED', handleEvent)

    return () => {
      es.close()
    }
  }, [conversationId, load])

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || sending) return
    
    setSending(true)
    try {
      await api.conversations.reply(conversationId, replyText.trim())
      setReplyText('')
    } catch (err) {
      console.error('Failed to send reply', err)
      alert('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = useCallback((newStatus: string) => {
    if (data) {
      setData(prev => prev ? { ...prev, status: newStatus } : null)
      // Refresh full data after brief delay to get new lifecycle event
      setTimeout(load, 800)
    }
  }, [data, load])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-blue)] border-t-transparent animate-spin" />
        <span className="text-sm text-muted-foreground">Carregando conversa…</span>
      </div>
    </div>
  )

  if (!data) return (
    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      Não foi possível carregar a conversa.
    </div>
  )

  const tabs = [
    { id: 'messages' as const, label: `Mensagens (${data.messages.length})` },
    { id: 'lifecycle' as const, label: `Histórico (${data.lifecycleEvents.length})` },
    ...(data.qualificationState ? [{ id: 'qualification' as const, label: 'Qualificação' }] : []),
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-foreground">
                {data.externalUserId ?? `Conversa #${data.conversationId.slice(0, 8)}`}
              </h2>
              <StatusBadge status={data.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Agente: <span className="font-medium">{data.agentId.slice(0, 8)}…</span>
              {' · '}
              Iniciada em {new Date(data.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="icon-sm" onClick={load} title="Atualizar">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="Fechar">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <ActionPanel
          status={data.status}
          conversationId={data.conversationId}
          onStatusChange={handleStatusChange}
        />

        {/* Summary */}
        {data.summary && (
          <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Resumo: </span>
              {data.summary}
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-border px-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'py-3 px-1 mr-6 text-sm border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-[var(--color-blue)] text-[var(--color-blue)] font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'messages' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 min-h-0">
              {data.messages.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                </div>
              ) : (
                data.messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
              )}
            </div>
            
            {data.status === 'HANDOFF_ACCEPTED' && (
              <div className="p-4 border-t border-border bg-muted/20 flex-shrink-0">
                <form onSubmit={handleSendReply} className="flex items-end gap-2 max-w-4xl mx-auto w-full">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Digite sua resposta como operador..."
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      disabled={sending}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)]"
                    />
                  </div>
                  <Button type="submit" variant="gradient" disabled={!replyText.trim() || sending}>
                    {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'lifecycle' && (
          <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
            {data.lifecycleEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento de ciclo de vida registrado.</p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Linha do tempo
                </p>
                <LifecycleTimeline events={data.lifecycleEvents} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'qualification' && data.qualificationState && (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Estado de Qualificação
            </p>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Score', value: data.qualificationState.leadScore !== null ? `${data.qualificationState.leadScore}/100` : '—' },
                { label: 'Intenção', value: data.qualificationState.intent ?? '—' },
                { label: 'Sentimento', value: data.qualificationState.sentiment ?? '—' },
                { label: 'Status', value: data.qualificationState.qualificationStatus ?? '—' },
              ].map(item => (
                <div key={item.label} className="bg-muted/40 border border-border rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>

            {Object.keys(data.qualificationState.extractedData ?? {}).length > 0 && (
              <div className="bg-muted/40 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Dados extraídos</p>
                <pre className="text-xs text-foreground leading-relaxed overflow-auto max-h-40">
                  {JSON.stringify(data.qualificationState.extractedData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.conversations.list()
      setConversations(data.conversations)
      setTotal(data.total)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  const filtered = conversations.filter(c =>
    statusFilter === '' || c.status === statusFilter
  )

  const handoffCount = conversations.filter(c => c.status === 'HANDOFF_REQUESTED').length

  return (
    <div className="flex" style={{ minHeight: 'calc(100dvh)' }}>
      {/* ── Left Panel: List ── */}
      <div
        className={cn(
          'flex flex-col border-r border-border bg-background transition-all duration-300',
          selectedId ? 'w-[340px] min-w-[280px] flex-shrink-0' : 'flex-1',
        )}
        style={{ position: 'sticky', top: 0, height: 'calc(100dvh)', overflowY: 'hidden' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-6 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
                Conversas
                {handoffCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold animate-pulse">
                    {handoffCount}
                  </span>
                )}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading ? 'Carregando…' : `${total} total`}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={loadList} disabled={loading}>
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </Button>
          </div>

          {/* Status filters */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                  statusFilter === f.value
                    ? 'bg-gradient-primary text-white border-transparent'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-[var(--color-blue)] border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {statusFilter ? 'Nenhuma conversa com este status' : 'Nenhuma conversa ainda'}
              </p>
            </div>
          ) : (
            filtered.map(conv => (
              <ConvListItem
                key={conv.id}
                conv={conv}
                selected={conv.id === selectedId}
                onClick={() => setSelectedId(conv.id === selectedId ? null : conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right Panel: Detail ── */}
      {selectedId ? (
        <div
          className="flex-1 flex flex-col min-w-0 bg-background"
          style={{ position: 'sticky', top: 0, height: 'calc(100dvh)', overflow: 'hidden' }}
        >
          <DetailPanel
            key={selectedId}
            conversationId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        </div>
      ) : (
        <div
          className="flex-1 hidden md:flex flex-col items-center justify-center gap-4 text-center px-8 bg-muted/20"
          style={{ position: 'sticky', top: 0, height: 'calc(100dvh)' }}
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Selecione uma conversa</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Escolha uma conversa na lista para ver mensagens, estado de qualificação e gerenciar handoffs.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
