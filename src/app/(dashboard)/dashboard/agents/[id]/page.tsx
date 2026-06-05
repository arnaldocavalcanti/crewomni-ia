'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, type AgentDetail, type MessageItem, type KnowledgeDocumentItem, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  ArrowLeft, Send, Bot, User, Archive, Zap, RotateCcw,
  BookOpen, Plus, Trash2, FileText, X, Loader2, Upload, PlayCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'prompt' | 'knowledge'

// ─── Knowledge helpers ────────────────────────────────────────────────────────

const LAYER_LABELS: Record<string, string> = {
  AGENT: 'Este agente',
  TENANT: 'Todos os agentes',
}

const STATUS_COLORS: Record<string, string> = {
  READY:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PROCESSING: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
  PENDING:    'bg-blue-500/10   text-blue-400   border-blue-500/20',
  FAILED:     'bg-red-500/10    text-red-400    border-red-500/20',
}

const STATUS_ACCENT: Record<string, string> = {
  READY:      'bg-emerald-500',
  PROCESSING: 'bg-amber-400',
  PENDING:    'bg-blue-400',
  FAILED:     'bg-red-500',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('prompt')

  // Agent state
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [newPrompt, setNewPrompt] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [archiving, setArchiving] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Knowledge state
  const [docs, setDocs] = useState<KnowledgeDocumentItem[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docLayer, setDocLayer] = useState<'AGENT' | 'TENANT'>('AGENT')
  const [docContent, setDocContent] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [ingestError, setIngestError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showPlayCircleInput, setShowPlayCircleInput] = useState(false)
  const [youtubeUrl, setPlayCircleUrl] = useState('')
  const [fetchingPlayCircle, setFetchingPlayCircle] = useState(false)

  // ─── Load agent ─────────────────────────────────────────────────────────────

  useEffect(() => {
    api.agents.get(id)
      .then(a => { setAgent(a); setNewPrompt(a.activePromptVersion?.systemPrompt ?? '') })
      .catch(() => router.push('/dashboard/agents'))
      .finally(() => setLoading(false))
  }, [id, router])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ─── Load documents when tab opens ──────────────────────────────────────────

  const loadDocs = useCallback(() => {
    setDocsLoading(true)
    api.knowledge.list(id)
      .then(r => setDocs(r.documents))
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false))
  }, [id])

  useEffect(() => {
    if (tab === 'knowledge') loadDocs()
  }, [tab, loadDocs])

  // ─── Prompt actions ──────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!newPrompt.trim()) return
    setPublishing(true)
    try {
      await api.agents.publishPrompt(id, newPrompt)
      const updated = await api.agents.get(id)
      setAgent(updated)
    } catch (err) {
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao arquivar.')
      setArchiving(false)
    }
  }

  function handleNewChat() {
    setMessages([])
    setConversationId(undefined)
    setChatInput('')
  }

  // ─── Chat actions ────────────────────────────────────────────────────────────

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim() || sending) return
    const text = chatInput.trim()
    setChatInput('')
    setSending(true)
    const userMsg: MessageItem = {
      id: `local-${Date.now()}`, role: 'USER', content: text,
      metadata: null, createdAt: new Date().toISOString(),
    }
    setMessages(m => [...m, userMsg])
    try {
      const result = await api.conversations.sendMessage({
        agentId: id, message: text, conversationId,
        externalUserId: 'dashboard-test',
      })
      if (!conversationId) setConversationId(result.conversationId)
      setMessages(m => [...m, {
        id: result.messageId, role: 'ASSISTANT', content: result.reply,
        metadata: { model: result.model, tokensUsed: result.tokensUsed },
        createdAt: new Date().toISOString(),
      }])
    } catch (err) {
      setMessages(m => [...m, {
        id: `err-${Date.now()}`, role: 'ASSISTANT',
        content: err instanceof Error ? err.message : 'Erro ao obter resposta.',
        metadata: { failed: true }, createdAt: new Date().toISOString(),
      }])
    } finally {
      setSending(false)
    }
  }

  // ─── Knowledge actions ───────────────────────────────────────────────────────

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault()
    if (!docTitle.trim() || !docContent.trim()) return
    setIngestError(null)
    setIngesting(true)
    try {
      await api.knowledge.ingest({
        title: docTitle.trim(),
        content: docContent.trim(),
        layer: docLayer,
        agentId: docLayer === 'AGENT' ? id : undefined,
      })
      setDocTitle('')
      setDocContent('')
      setDocLayer('AGENT')
      setShowAddForm(false)
      loadDocs()
    } catch (err) {
      setIngestError(err instanceof ApiError ? err.message : 'Erro ao ingerir documento.')
    } finally {
      setIngesting(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIngestError(null)
    setParsing(true)
    if (!showAddForm) setShowAddForm(true)
    try {
      const result = await api.knowledge.parseFile(file)
      setDocTitle(result.title)
      setDocContent(result.content)
    } catch (err) {
      setIngestError(err instanceof ApiError ? err.message : 'Erro ao processar arquivo.')
    } finally {
      setParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleFetchPlayCircle(e: React.FormEvent) {
    e.preventDefault()
    if (!youtubeUrl.trim()) return
    setIngestError(null)
    setFetchingPlayCircle(true)
    if (!showAddForm) setShowAddForm(true)
    try {
      const result = await api.knowledge.parseYoutube(youtubeUrl.trim())
      setDocTitle(result.title)
      setDocContent(result.content)
      setPlayCircleUrl('')
      setShowPlayCircleInput(false)
    } catch (err) {
      setIngestError(err instanceof ApiError ? err.message : 'Erro ao buscar transcrição.')
    } finally {
      setFetchingPlayCircle(false)
    }
  }

  async function handleDeleteDoc(docId: string, title: string) {
    if (!confirm(`Remover "${title}" da base de conhecimento?`)) return
    setDeletingId(docId)
    try {
      await api.knowledge.delete(docId)
      setDocs(prev => prev.filter(d => d.id !== docId))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao remover documento.')
    } finally {
      setDeletingId(null)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

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
            <p className="text-sm text-muted-foreground mt-0.5">
              {agent.type}{agent.description ? ` · ${agent.description}` : ''}
            </p>
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

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'prompt',    label: 'Prompt & Chat' },
          { key: 'knowledge', label: 'Base de Conhecimento' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Prompt & Chat ─────────────────────────────────────────────── */}
      {tab === 'prompt' && (
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
                className="bg-input border-border font-mono text-sm resize-none min-h-[200px] max-h-[60vh] overflow-y-auto"
                placeholder="System prompt do agente…"
              />
            </CardContent>
          </Card>

          {/* Chat de teste */}
          <Card className="bg-card border-border flex flex-col">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Chat de teste</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Teste o agente em tempo real
                  </CardDescription>
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={handleNewChat}
                    title="Nova conversa"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary flex-shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Nova conversa
                  </button>
                )}
              </div>
            </CardHeader>
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
                      msg.role === 'USER' ? 'bg-primary/20' : 'bg-secondary',
                    )}>
                      {msg.role === 'USER'
                        ? <User className="w-3.5 h-3.5 text-primary" />
                        : <Bot className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                    <div className={cn(
                      'max-w-[80%] px-3 py-2 rounded-xl text-sm',
                      msg.role === 'USER'
                        ? 'bg-primary text-white rounded-tr-sm'
                        : msg.metadata?.failed
                          ? 'bg-red-950 text-red-300 border border-red-800 rounded-tl-sm'
                          : 'bg-secondary text-foreground rounded-tl-sm',
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
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                            style={{ animationDelay: `${i * 100}ms` }} />
                        ))}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
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
      )}

      {/* ── Tab: Base de Conhecimento ──────────────────────────────────────── */}
      {tab === 'knowledge' && (
        <div className="space-y-4">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {docs.length === 0
                ? 'Nenhum documento ainda'
                : `${docs.length} documento${docs.length > 1 ? 's' : ''} na base`}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {/* YouTube button */}
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={fetchingPlayCircle}
                onClick={() => { setShowPlayCircleInput(v => !v); setIngestError(null) }}
              >
                {fetchingPlayCircle
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <PlayCircle className="w-4 h-4 text-red-500" />}
                {fetchingPlayCircle ? 'Buscando…' : 'YouTube'}
              </Button>
              {/* File upload button */}
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={parsing}
                onClick={() => fileInputRef.current?.click()}
              >
                {parsing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Upload className="w-4 h-4" />}
                {parsing ? 'Lendo…' : '.txt / .pdf'}
              </Button>
              {!showAddForm && (
                <Button size="sm" className="gap-2" onClick={() => setShowAddForm(true)}>
                  <Plus className="w-4 h-4" />
                  Colar texto
                </Button>
              )}
            </div>
          </div>

          {/* YouTube URL inline input */}
          {showPlayCircleInput && (
            <form onSubmit={handleFetchPlayCircle} className="flex items-center gap-2">
              <Input
                value={youtubeUrl}
                onChange={e => setPlayCircleUrl(e.target.value)}
                placeholder="Cole a URL do vídeo: https://youtube.com/watch?v=..."
                autoFocus
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={fetchingPlayCircle || !youtubeUrl.trim()} className="gap-1.5 flex-shrink-0">
                {fetchingPlayCircle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                {fetchingPlayCircle ? 'Buscando…' : 'Buscar transcrição'}
              </Button>
              <button
                type="button"
                onClick={() => { setShowPlayCircleInput(false); setPlayCircleUrl('') }}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Inline add form */}
          {showAddForm && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Novo documento</CardTitle>
                  <button
                    onClick={() => { setShowAddForm(false); setIngestError(null) }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleIngest} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Title */}
                    <div className="space-y-1.5">
                      <Label htmlFor="doc-title" className="text-sm font-medium">Título</Label>
                      <Input
                        id="doc-title"
                        value={docTitle}
                        onChange={e => setDocTitle(e.target.value)}
                        placeholder="Ex: Script de qualificação SDR"
                        required
                        autoFocus
                      />
                    </div>

                    {/* Layer */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Visibilidade</Label>
                      <div className="flex gap-2">
                        {([
                          { value: 'AGENT',  label: 'Só este agente' },
                          { value: 'TENANT', label: 'Todos os agentes' },
                        ] as const).map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setDocLayer(opt.value)}
                            className={cn(
                              'flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors',
                              docLayer === opt.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-card text-muted-foreground hover:bg-secondary/40',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="doc-content" className="text-sm font-medium">Conteúdo</Label>
                      <span className="text-xs text-muted-foreground">{docContent.length} caracteres</span>
                    </div>
                    <Textarea
                      id="doc-content"
                      value={docContent}
                      onChange={e => setDocContent(e.target.value)}
                      placeholder="Cole aqui o texto que o agente deve conhecer: scripts, FAQs, manual do produto, argumentos de venda…"
                      rows={8}
                      required
                      minLength={50}
                      className="font-mono text-sm resize-none"
                    />
                    <p className="text-xs text-muted-foreground">Mínimo 50 caracteres. Quanto mais contexto, melhor o agente responde.</p>
                  </div>

                  {ingestError && (
                    <p className="text-sm text-destructive">{ingestError}</p>
                  )}

                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={ingesting || !docTitle.trim() || docContent.trim().length < 50} className="gap-2">
                      {ingesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {ingesting ? 'Processando…' : 'Ingerir documento'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setShowAddForm(false); setIngestError(null) }}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Document list */}
          {docsLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-16 rounded-xl border border-border bg-secondary/30 animate-pulse" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 border border-dashed border-border rounded-xl">
              <BookOpen className="w-9 h-9 text-muted-foreground/40" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Base de conhecimento vazia</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Adicione documentos para o agente responder com mais precisão</p>
              </div>
              {!showAddForm && (
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)} className="gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar primeiro documento
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="relative flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 overflow-hidden hover:bg-secondary/20 transition-colors"
                >
                  {/* Status accent */}
                  <div className={cn('absolute left-0 top-0 bottom-0 w-1', STATUS_ACCENT[doc.status] ?? 'bg-muted')} />

                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-1" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {/* Layer badge */}
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {LAYER_LABELS[doc.layer] ?? doc.layer}
                      </span>
                      {/* Status badge */}
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded-full border',
                        STATUS_COLORS[doc.status] ?? 'bg-muted text-muted-foreground',
                      )}>
                        {doc.status}
                      </span>
                      {/* Chunks */}
                      {doc.chunksCount > 0 && (
                        <span className="text-[10px] text-muted-foreground/60">
                          {doc.chunksCount} chunk{doc.chunksCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Date */}
                  <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                    {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                  </span>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteDoc(doc.id, doc.title)}
                    disabled={deletingId === doc.id}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 flex-shrink-0"
                    title="Remover documento"
                  >
                    {deletingId === doc.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
