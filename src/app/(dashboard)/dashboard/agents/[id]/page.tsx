'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, type AgentDetail, type MessageItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { ArrowLeft, Send, Bot, User, Archive, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [newPrompt, setNewPrompt] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [archiving, setArchiving] = useState(false)

  // Chat test state
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.agents.get(id).then(a => {
      setAgent(a)
      setNewPrompt(a.activePromptVersion?.systemPrompt ?? '')
    }).catch(() => router.push('/dashboard/agents')).finally(() => setLoading(false))
  }, [id, router])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handlePublish() {
    if (!newPrompt.trim()) return
    setPublishing(true)
    try {
      await api.agents.publishPrompt(id, newPrompt)
      const updated = await api.agents.get(id)
      setAgent(updated)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao publicar prompt.')
    } finally {
      setPublishing(false)
    }
  }

  async function handleArchive() {
    if (!confirm('Arquivar este agente?')) return
    setArchiving(true)
    try {
      await api.agents.updateStatus(id, 'ARCHIVED')
      router.push('/dashboard/agents')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao arquivar.')
      setArchiving(false)
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim() || sending) return
    const text = chatInput.trim()
    setChatInput('')
    setSending(true)

    const userMsg: MessageItem = {
      id: `local-${Date.now()}`, role: 'USER', content: text, metadata: null,
      createdAt: new Date().toISOString(),
    }
    setMessages(m => [...m, userMsg])

    try {
      const result = await api.conversations.sendMessage({
        agentId: id, message: text, conversationId,
        externalUserId: 'dashboard-test',
      })
      if (!conversationId) setConversationId(result.conversationId)
      const assistantMsg: MessageItem = {
        id: result.messageId, role: 'ASSISTANT', content: result.reply,
        metadata: { model: result.model, tokensUsed: result.tokensUsed },
        createdAt: new Date().toISOString(),
      }
      setMessages(m => [...m, assistantMsg])
    } catch (err: unknown) {
      const failMsg: MessageItem = {
        id: `err-${Date.now()}`, role: 'ASSISTANT',
        content: err instanceof Error ? err.message : 'Erro ao obter resposta.',
        metadata: { failed: true }, createdAt: new Date().toISOString(),
      }
      setMessages(m => [...m, failMsg])
    } finally {
      setSending(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Carregando…</p>
    </div>
  )

  if (!agent) return null

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/agents">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold text-foreground">{agent.name}</h1>
              <StatusBadge status={agent.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{agent.type}{agent.description ? ` · ${agent.description}` : ''}</p>
          </div>
        </div>
        {agent.status !== 'ARCHIVED' && (
          <Button variant="outline" size="sm" onClick={handleArchive} disabled={archiving}
            className="text-muted-foreground border-border hover:text-destructive hover:border-destructive gap-2">
            <Archive className="w-4 h-4" />
            {archiving ? 'Arquivando…' : 'Arquivar'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Prompt */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">System Prompt</CardTitle>
                {agent.activePromptVersion && (
                  <CardDescription className="text-muted-foreground text-xs mt-0.5">
                    Versão {agent.activePromptVersion.version} · <StatusBadge status={agent.activePromptVersion.status} />
                  </CardDescription>
                )}
              </div>
              <Button size="sm" onClick={handlePublish} disabled={publishing} className="gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                {publishing ? 'Publicando…' : 'Publicar'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={newPrompt}
              onChange={e => setNewPrompt(e.target.value)}
              rows={14}
              className="bg-input border-border font-mono text-sm resize-none"
              placeholder="System prompt do agente…"
            />
          </CardContent>
        </Card>

        {/* Chat de teste */}
        <Card className="bg-card border-border flex flex-col">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base">Chat de teste</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Teste o agente em tempo real
            </CardDescription>
          </CardHeader>

          {/* Messages */}
          <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 max-h-80">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <Bot className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Envie uma mensagem para começar</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={cn('flex gap-2', msg.role === 'USER' && 'flex-row-reverse')}>
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                    msg.role === 'USER' ? 'bg-primary/20' : 'bg-secondary'
                  )}>
                    {msg.role === 'USER'
                      ? <User className="w-3.5 h-3.5 text-primary" />
                      : <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                  </div>
                  <div className={cn(
                    'max-w-[80%] px-3 py-2 rounded-xl text-sm',
                    msg.role === 'USER'
                      ? 'bg-primary text-white rounded-tr-sm'
                      : msg.metadata?.failed
                        ? 'bg-red-950 text-red-300 border border-red-800 rounded-tl-sm'
                        : 'bg-secondary text-foreground rounded-tl-sm'
                  )}>
                    {msg.content}
                    {msg.role === 'ASSISTANT' && msg.metadata?.model && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {msg.metadata.model} · {msg.metadata.tokensUsed}t
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="bg-secondary px-3 py-2 rounded-xl rounded-tl-sm">
                    <span className="flex gap-1">
                      {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{animationDelay:`${i*100}ms`}} />)}
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Digite uma mensagem…"
                disabled={sending || agent.status !== 'ACTIVE'}
                className="flex-1 bg-input border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
              <Button type="submit" size="icon" className="h-8 w-8 flex-shrink-0"
                disabled={sending || !chatInput.trim() || agent.status !== 'ACTIVE'}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
            {agent.status !== 'ACTIVE' && (
              <p className="text-xs text-muted-foreground text-center pb-2">
                Publique o prompt para ativar o agente
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
