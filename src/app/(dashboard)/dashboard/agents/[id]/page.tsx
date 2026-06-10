'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  api, type AgentDetail, type MessageItem, type KnowledgeDocumentItem,
  type AgentRoleItem, type DepartmentItem, type CrewItem, type AgentListItem, ApiError,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  ArrowLeft, Plus, Check, MessageSquare, ShieldAlert, Cpu,
  Send, Bot, User, Zap, RotateCcw, BookOpen, Trash2, FileText,
  X, Loader2, Upload, PlayCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Comercial', 'Atendimento', 'Suporte', 'Financeiro',
  'Jurídico', 'RH', 'Operações', 'Marketing', 'Customizado',
]

const OPERATIONAL_FUNCTIONS = [
  { value: 'Conversacional', label: 'Conversacional (interage diretamente)' },
  { value: 'Analisador', label: 'Analisador (audita e gera relatórios)' },
  { value: 'Criador de conteúdo', label: 'Criador de conteúdo' },
  { value: 'Executor de ação', label: 'Executor de ação (integrações externas)' },
  { value: 'Supervisor / Diretor', label: 'Supervisor / Diretor (orquestra crews)' },
  { value: 'Monitor', label: 'Monitor' },
  { value: 'Follow-up / Reativação', label: 'Follow-up / Reativação' },
  { value: 'Roteador', label: 'Roteador' },
  { value: 'Handoff humano', label: 'Handoff humano' },
]

const MAIN_CHANNELS = ['WhatsApp', 'E-mail', 'Webchat', 'API', 'WhatsApp + E-mail']
const AUTONOMY_LEVELS = ['Baixa', 'Média', 'Alta']
const COMMUNICATION_STYLES = [
  'Empático e direto', 'Conciso e profissional', 'Detalhado e consultivo', 'Formal',
]
const TONE_OF_VOICES = [
  'Profissional e consultivo', 'Amigável e acolhedor', 'Técnico e formal', 'Entusiasmado',
]
const OUTPUT_FORMATS = [
  'Texto livre', 'JSON estruturado', 'Mensagem WhatsApp', 'E-mail', 'Decisão de roteamento',
]

const LAYER_LABELS: Record<string, string> = {
  AGENT: 'Este agente',
  TENANT: 'Todos os agentes',
}

const STATUS_ACCENT: Record<string, string> = {
  READY: 'bg-emerald-500',
  PROCESSING: 'bg-amber-400',
  PENDING: 'bg-blue-400',
  FAILED: 'bg-red-500',
}

const STATUS_COLORS: Record<string, string> = {
  READY: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PROCESSING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PENDING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
}

type Tab = 'identity' | 'prompt' | 'knowledge'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('identity')
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [pageLoading, setPageLoading] = useState(true)

  // Form state (mirroring new/page.tsx)
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Comercial',
    roleId: '',
    operationalFunction: 'Conversacional',
    status: 'ACTIVE',
    departmentId: '',
    crewId: '',
    directorId: '',
    mainChannel: 'WhatsApp + E-mail',
    toneOfVoice: 'Profissional e consultivo',
    communicationStyle: 'Empático e direto',
    autonomyLevel: 'Média',
    responsibilities: [] as string[],
    permissionReadKB: true,
    permissionSendWhatsapp: true,
    permissionSendEmail: true,
    permissionExecuteTool: false,
    permissionCallHuman: true,
    permissionCreateTask: true,
    permissionReadHistory: true,
    permissionReadCommercial: true,
    systemPrompt: '',
    outputFormat: 'Texto livre',
    expectedExamples: '',
    specificRules: '',
  })

  // Dropdowns
  const [roles, setRoles] = useState<AgentRoleItem[]>([])
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [crews, setCrews] = useState<CrewItem[]>([])
  const [agents, setAgents] = useState<AgentListItem[]>([])

  // Custom role inline
  const [showNewRoleForm, setShowNewRoleForm] = useState(false)
  const [newRole, setNewRole] = useState({ name: '', category: 'Comercial', description: '' })
  const [creatingRole, setCreatingRole] = useState(false)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

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
  const [showYoutubeInput, setShowYoutubeInput] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [fetchingYoutube, setFetchingYoutube] = useState(false)

  // ─── Load agent + dropdowns ─────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [agentData, rolesList, deptsList, crewsList, agentsList] = await Promise.all([
          api.agents.get(id),
          api.agents.roles.list(),
          api.departments.list(),
          api.crews.list(),
          api.agents.list(),
        ])
        setAgent(agentData)
        setRoles(rolesList)
        setDepartments(deptsList)
        setCrews(crewsList)
        setAgents(agentsList.filter(a => a.id !== id))

        setForm({
          name: agentData.name,
          description: agentData.description ?? '',
          category: agentData.category,
          roleId: agentData.roleId,
          operationalFunction: agentData.operationalFunction,
          status: agentData.status,
          departmentId: '',
          crewId: agentData.crewMembership?.crewId ?? '',
          directorId: agentData.directorId ?? '',
          mainChannel: agentData.mainChannel ?? 'WhatsApp + E-mail',
          toneOfVoice: agentData.toneOfVoice ?? 'Profissional e consultivo',
          communicationStyle: agentData.communicationStyle ?? 'Empático e direto',
          autonomyLevel: agentData.autonomyLevel ?? 'Média',
          responsibilities: agentData.responsibilities ?? [],
          permissionReadKB: agentData.permissionReadKB,
          permissionSendWhatsapp: agentData.permissionSendWhatsapp,
          permissionSendEmail: agentData.permissionSendEmail,
          permissionExecuteTool: agentData.permissionExecuteTool,
          permissionCallHuman: agentData.permissionCallHuman,
          permissionCreateTask: agentData.permissionCreateTask,
          permissionReadHistory: agentData.permissionReadHistory,
          permissionReadCommercial: agentData.permissionReadCommercial,
          systemPrompt: agentData.activePromptVersion?.systemPrompt ?? '',
          outputFormat: agentData.outputFormat ?? 'Texto livre',
          expectedExamples: agentData.expectedExamples ?? '',
          specificRules: agentData.specificRules ?? '',
        })
      } catch {
        router.push('/dashboard/agents')
      } finally {
        setPageLoading(false)
      }
    }
    load()
  }, [id, router])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  // ─── Form helpers ────────────────────────────────────────────────────────────

  function set(field: string, value: unknown) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function toggleResponsibility(resp: string) {
    setForm(f => {
      const next = f.responsibilities.includes(resp)
        ? f.responsibilities.filter(r => r !== resp)
        : [...f.responsibilities, resp]
      return { ...f, responsibilities: next }
    })
  }

  async function handleCreateRole() {
    if (!newRole.name.trim()) return
    setCreatingRole(true)
    try {
      const created = await api.agents.roles.create({
        name: newRole.name,
        category: newRole.category,
        description: newRole.description.trim() || undefined,
      })
      setRoles(prev => [created, ...prev])
      setForm(f => ({ ...f, roleId: created.id, category: created.category }))
      setShowNewRoleForm(false)
      setNewRole({ name: '', category: 'Comercial', description: '' })
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao criar papel')
    } finally {
      setCreatingRole(false)
    }
  }

  // ─── Save handler ────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.roleId) { setSaveError('Selecione ou crie um papel para o agente.'); return }
    setSaveError('')
    setSaving(true)
    try {
      await api.agents.update(id, {
        name: form.name,
        description: form.description.trim() || undefined,
        category: form.category,
        roleId: form.roleId,
        operationalFunction: form.operationalFunction,
        directorId: form.directorId || null,
        mainChannel: form.mainChannel,
        toneOfVoice: form.toneOfVoice,
        communicationStyle: form.communicationStyle,
        autonomyLevel: form.autonomyLevel,
        responsibilities: form.responsibilities,
        permissionReadKB: form.permissionReadKB,
        permissionSendWhatsapp: form.permissionSendWhatsapp,
        permissionSendEmail: form.permissionSendEmail,
        permissionExecuteTool: form.permissionExecuteTool,
        permissionCallHuman: form.permissionCallHuman,
        permissionCreateTask: form.permissionCreateTask,
        permissionReadHistory: form.permissionReadHistory,
        permissionReadCommercial: form.permissionReadCommercial,
        outputFormat: form.outputFormat,
        expectedExamples: form.expectedExamples.trim() || undefined,
        specificRules: form.specificRules.trim() || undefined,
      })

      // Publish system prompt if changed
      if (form.systemPrompt.trim().length >= 10) {
        await api.agents.publishPrompt(id, form.systemPrompt)
      }

      // Handle crew membership change
      const oldMembership = agent?.crewMembership ?? null
      const newCrewId = form.crewId && form.crewId !== 'sem-crew' ? form.crewId : null
      const oldCrewId = oldMembership?.crewId ?? null

      if (oldCrewId !== newCrewId) {
        if (oldMembership) {
          await api.crews.removeMember(oldCrewId!, oldMembership.id).catch(() => {})
        }
        if (newCrewId) {
          await api.crews.addMember(newCrewId, { agentId: id, role: 'MEMBER', order: 0 })
        }
      }

      router.push('/dashboard/agents')
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar agente.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Chat handlers ───────────────────────────────────────────────────────────

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
      const result = await api.conversations.sendMessage({ agentId: id, message: text, conversationId, externalUserId: 'dashboard-test' })
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

  // ─── Knowledge handlers ──────────────────────────────────────────────────────

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault()
    if (!docTitle.trim() || !docContent.trim()) return
    setIngestError(null)
    setIngesting(true)
    try {
      await api.knowledge.ingest({ title: docTitle.trim(), content: docContent.trim(), layer: docLayer, agentId: docLayer === 'AGENT' ? id : undefined })
      setDocTitle(''); setDocContent(''); setDocLayer('AGENT'); setShowAddForm(false)
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
    setIngestError(null); setParsing(true)
    if (!showAddForm) setShowAddForm(true)
    try {
      const result = await api.knowledge.parseFile(file)
      setDocTitle(result.title); setDocContent(result.content)
    } catch (err) {
      setIngestError(err instanceof ApiError ? err.message : 'Erro ao processar arquivo.')
    } finally {
      setParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleFetchYoutube(e: React.FormEvent) {
    e.preventDefault()
    if (!youtubeUrl.trim()) return
    setIngestError(null); setFetchingYoutube(true)
    if (!showAddForm) setShowAddForm(true)
    try {
      const result = await api.knowledge.parseYoutube(youtubeUrl.trim())
      setDocTitle(result.title); setDocContent(result.content)
      setYoutubeUrl(''); setShowYoutubeInput(false)
    } catch (err) {
      setIngestError(err instanceof ApiError ? err.message : 'Erro ao buscar transcrição.')
    } finally {
      setFetchingYoutube(false)
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

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const selectedRoleName = roles.find(r => r.id === form.roleId)?.name || 'Selecione um papel'
  const selectedDeptName = departments.find(d => d.id === form.departmentId)?.name || 'Não vinculado'
  const selectedCrewName = crews.find(c => c.id === form.crewId)?.name || 'Não vinculado'
  const selectedDirectorName = agents.find(a => a.id === form.directorId)?.name || 'Nenhum'

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (pageLoading) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Carregando…</p>
    </div>
  )
  if (!agent) return null

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/agents">
            <Button variant="ghost" size="icon" className="h-9 w-9 border border-border">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{agent.name}</h1>
              <StatusBadge status={agent.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Editar configurações do agente</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/agents">
            <Button variant="outline" type="button" className="border-border">Cancelar</Button>
          </Link>
          <Button onClick={handleSave} type="button" variant="gradient" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar agente'}
          </Button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'identity', label: 'Identidade & Comportamento' },
          { key: 'prompt', label: 'Prompt & Chat' },
          { key: 'knowledge', label: 'Base de Conhecimento' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Identity & Behavior ───────────────────────────────────────── */}
      {tab === 'identity' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left: Form */}
          <form onSubmit={handleSave} className="lg:col-span-8 space-y-6">

            {/* Bloco 1: Identidade */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-color-cyan" /> Identidade do agente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm text-muted-foreground font-medium">Nome do agente *</Label>
                    <Input id="name" value={form.name} onChange={e => set('name', e.target.value)} required
                      className="bg-input border-border h-10 rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-sm text-muted-foreground font-medium">Descrição curta</Label>
                    <Input id="description" value={form.description} onChange={e => set('description', e.target.value)}
                      className="bg-input border-border h-10 rounded-lg" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground font-medium">Categoria *</Label>
                    <Select value={form.category} onValueChange={v => set('category', v)}>
                      <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground font-medium">Papel do agente *</Label>
                      <button type="button" onClick={() => setShowNewRoleForm(!showNewRoleForm)}
                        className="text-xs text-color-blue hover:text-color-purple transition font-medium flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Criar novo papel
                      </button>
                    </div>
                    <Select value={form.roleId} onValueChange={v => set('roleId', v)}>
                      <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                        <SelectValue placeholder="Selecione o papel">
                          {form.roleId ? (roles.find(r => r.id === form.roleId)?.name ?? 'Selecione o papel') : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border min-w-[280px]">
                        {roles.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name} {r.tenantId ? '(Custom)' : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {showNewRoleForm && (
                  <div className="p-4 bg-muted/40 border border-dashed border-border rounded-xl space-y-4 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-color-purple">Novo papel personalizado</span>
                      <button type="button" onClick={() => setShowNewRoleForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Nome do papel *</Label>
                        <Input value={newRole.name} onChange={e => setNewRole(r => ({ ...r, name: e.target.value }))}
                          className="bg-input border-border h-9 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Categoria *</Label>
                        <Select value={newRole.category} onValueChange={v => setNewRole(r => ({ ...r, category: v || 'Comercial' }))}>
                          <SelectTrigger className="bg-input border-border h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Textarea placeholder="Descreva os objetivos principais do papel…"
                      value={newRole.description} onChange={e => setNewRole(r => ({ ...r, description: e.target.value }))}
                      rows={2} className="bg-input border-border text-sm" />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowNewRoleForm(false)}>Cancelar</Button>
                      <Button type="button" size="sm" onClick={handleCreateRole} disabled={creatingRole || !newRole.name.trim()}>
                        {creatingRole ? 'Salvando…' : 'Salvar papel'}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground font-medium">Função operacional *</Label>
                    <Select value={form.operationalFunction} onValueChange={v => set('operationalFunction', v)}>
                      <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                        <SelectValue>
                          {form.operationalFunction
                            ? (OPERATIONAL_FUNCTIONS.find(f => f.value === form.operationalFunction)?.label ?? form.operationalFunction)
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border w-[480px] max-w-[90vw]">
                        {OPERATIONAL_FUNCTIONS.map(f => (
                          <SelectItem key={f.value} value={f.value} className="whitespace-normal py-2.5">{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground font-medium">Status *</Label>
                    <Select value={form.status} onValueChange={v => set('status', v)}>
                      <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                        <SelectValue>{form.status === 'ACTIVE' ? 'Ativo' : 'Rascunho'}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="ACTIVE">Ativo</SelectItem>
                        <SelectItem value="DRAFT">Rascunho</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bloco 2: Contexto Organizacional */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Contexto organizacional</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground font-medium">Departamento</Label>
                  <Select value={form.departmentId} onValueChange={v => set('departmentId', v)}>
                    <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                      <SelectValue placeholder="Selecione o departamento">
                        {form.departmentId === 'sem-departamento' ? 'Nenhum'
                          : form.departmentId ? (departments.find(d => d.id === form.departmentId)?.name ?? 'Selecione') : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="sem-departamento">Nenhum</SelectItem>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground font-medium">Crew</Label>
                  <Select value={form.crewId} onValueChange={v => set('crewId', v)}>
                    <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                      <SelectValue placeholder="Vincular a uma crew" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="sem-crew">Nenhum</SelectItem>
                      {crews.filter(c => !form.departmentId || form.departmentId === 'sem-departamento' || c.departmentId === form.departmentId)
                        .map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground font-medium">Diretor responsável</Label>
                  <Select value={form.directorId} onValueChange={v => set('directorId', v)}>
                    <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                      <SelectValue placeholder="Diretor supervisor" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="sem-diretor">Nenhum</SelectItem>
                      {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground font-medium">Canal principal</Label>
                  <Select value={form.mainChannel} onValueChange={v => set('mainChannel', v)}>
                    <SelectTrigger className="bg-input border-border h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {MAIN_CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Bloco 3: Comportamento */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Comportamento e autonomia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground font-medium">Tom de voz</Label>
                    <Select value={form.toneOfVoice} onValueChange={v => set('toneOfVoice', v)}>
                      <SelectTrigger className="bg-input border-border h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {TONE_OF_VOICES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground font-medium">Estilo de comunicação</Label>
                    <Select value={form.communicationStyle} onValueChange={v => set('communicationStyle', v)}>
                      <SelectTrigger className="bg-input border-border h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {COMMUNICATION_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                    Nível de autonomia
                    <span className="text-[10px] text-muted-foreground bg-muted border px-1.5 py-0.5 rounded font-normal">Info</span>
                  </Label>
                  <div className="flex gap-2">
                    {AUTONOMY_LEVELS.map(level => {
                      const active = form.autonomyLevel === level
                      return (
                        <button key={level} type="button" onClick={() => set('autonomyLevel', level)}
                          className={`flex-1 h-10 rounded-lg text-sm font-medium border transition ${active
                            ? 'bg-gradient-primary text-white border-transparent shadow-sm'
                            : 'bg-input text-muted-foreground border-border hover:bg-muted/50'}`}>
                          {level}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground font-medium">Modo de atuação</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {[
                      { id: 'atende_direto', label: 'Atende clientes diretamente' },
                      { id: 'apoia_agente', label: 'Apoia outro agente' },
                      { id: 'analisa_conversas', label: 'Analisa conversas' },
                      { id: 'cria_mensagens', label: 'Cria mensagens' },
                      { id: 'executa_tarefas', label: 'Executa tarefas' },
                      { id: 'supervisiona_crew', label: 'Supervisiona uma crew' },
                    ].map(item => {
                      const checked = form.responsibilities.includes(item.id)
                      return (
                        <label key={item.id} className="flex items-center gap-3 p-3 bg-muted/20 border border-border rounded-xl cursor-pointer hover:bg-muted/40 transition">
                          <input type="checkbox" checked={checked} onChange={() => toggleResponsibility(item.id)}
                            className="h-4 w-4 rounded border-border text-color-blue focus:ring-color-blue" />
                          <span className="text-sm text-foreground font-medium">{item.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bloco 4: Permissões */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Permissões e ferramentas</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'permissionReadKB', label: 'Consultar base de conhecimento' },
                  { id: 'permissionSendWhatsapp', label: 'Enviar WhatsApp' },
                  { id: 'permissionSendEmail', label: 'Enviar e-mail' },
                  { id: 'permissionExecuteTool', label: 'Executar ferramenta MCP/CLI' },
                  { id: 'permissionCallHuman', label: 'Acionar closer humano' },
                  { id: 'permissionCreateTask', label: 'Criar tarefa' },
                  { id: 'permissionReadHistory', label: 'Acessar histórico da conversa' },
                  { id: 'permissionReadCommercial', label: 'Acessar dados comerciais' },
                ].map(perm => {
                  const isOn = form[perm.id as keyof typeof form] as boolean
                  return (
                    <div key={perm.id} onClick={() => set(perm.id, !isOn)}
                      className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-all ${isOn
                        ? 'bg-[var(--color-blue)]/8 border-[var(--color-blue)]/30'
                        : 'bg-input/40 border-border hover:bg-muted/60'}`}>
                      <span className={`text-sm font-medium transition-colors ${isOn ? 'text-[var(--color-blue)]' : 'text-muted-foreground'}`}>
                        {perm.label}
                      </span>
                      <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${isOn ? 'bg-[var(--color-blue)]' : 'bg-gray-300'}`}>
                        <div className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${isOn ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {saveError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> {saveError}
              </p>
            )}
          </form>

          {/* Right: Preview Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="sticky top-8 space-y-6">
              <Card className="bg-card border-border shadow-sm rounded-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm uppercase tracking-wider text-color-purple">Preview do agente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {[
                    { label: 'Nome', value: form.name || 'Sem nome', bold: true },
                    { label: 'Categoria', value: form.category, chip: 'cyan' },
                    { label: 'Papel', value: selectedRoleName, chip: 'purple' },
                    { label: 'Função operacional', value: form.operationalFunction },
                    { label: 'Departamento', value: selectedDeptName },
                    { label: 'Crew', value: selectedCrewName },
                    { label: 'Diretor', value: selectedDirectorName },
                    { label: 'Canais', value: form.mainChannel, blue: true },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between border-b border-border/60 pb-2">
                      <span className="text-muted-foreground font-medium">{row.label}</span>
                      {row.chip === 'cyan' && (
                        <span className="px-2 py-0.5 rounded bg-color-cyan/15 text-xs text-color-cyan font-bold uppercase">{row.value}</span>
                      )}
                      {row.chip === 'purple' && (
                        <span className="text-color-purple font-bold">{row.value}</span>
                      )}
                      {row.blue && <span className="font-medium text-color-blue">{row.value}</span>}
                      {!row.chip && !row.blue && <span className={`text-foreground ${row.bold ? 'font-bold' : ''}`}>{row.value}</span>}
                    </div>
                  ))}
                  <div className="flex justify-between pb-1">
                    <span className="text-muted-foreground font-medium">Status</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${form.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {form.status === 'ACTIVE' ? 'Ativo' : 'Rascunho'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground block mb-2 font-semibold">Permissões ativadas</span>
                    <div className="flex flex-wrap gap-1.5">
                      {form.permissionReadKB && <span className="text-[10px] bg-muted px-2 py-0.5 border border-border rounded-full font-medium">Base de conhecimento</span>}
                      {form.permissionSendWhatsapp && <span className="text-[10px] bg-muted px-2 py-0.5 border border-border rounded-full font-medium">WhatsApp</span>}
                      {form.permissionSendEmail && <span className="text-[10px] bg-muted px-2 py-0.5 border border-border rounded-full font-medium">E-mail</span>}
                      {form.permissionExecuteTool && <span className="text-[10px] bg-muted px-2 py-0.5 border border-border rounded-full font-medium">Executor MCP</span>}
                      {form.permissionCallHuman && <span className="text-[10px] bg-muted px-2 py-0.5 border border-border rounded-full font-medium">Acionar closer</span>}
                      {form.permissionCreateTask && <span className="text-[10px] bg-muted px-2 py-0.5 border border-border rounded-full font-medium">Criar tarefa</span>}
                      {form.permissionReadHistory && <span className="text-[10px] bg-muted px-2 py-0.5 border border-border rounded-full font-medium">Histórico conversa</span>}
                      {form.permissionReadCommercial && <span className="text-[10px] bg-muted px-2 py-0.5 border border-border rounded-full font-medium">Dados comerciais</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Prompt & Chat ─────────────────────────────────────────────── */}
      {tab === 'prompt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">System Prompt e instruções</CardTitle>
                    <CardDescription className="text-muted-foreground text-sm">Instruções comportamentais, restrições e regras para o agente.</CardDescription>
                  </div>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    {saving ? 'Salvando…' : 'Salvar'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="systemPrompt" className="text-sm text-muted-foreground font-medium">System Prompt *</Label>
                    <span className="text-xs text-muted-foreground">{form.systemPrompt.length} caracteres</span>
                  </div>
                  <Textarea id="systemPrompt" value={form.systemPrompt} onChange={e => set('systemPrompt', e.target.value)}
                    className="bg-input border-border font-mono text-sm resize-y min-h-[200px] max-h-[500px] overflow-y-auto" />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground font-medium">Formato de saída</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {OUTPUT_FORMATS.map(fmt => {
                      const active = form.outputFormat === fmt
                      return (
                        <button key={fmt} type="button" onClick={() => set('outputFormat', fmt)}
                          className={`h-10 rounded-lg text-xs font-semibold border transition ${active
                            ? 'bg-gradient-primary text-white border-transparent shadow-sm'
                            : 'bg-input text-muted-foreground border-border hover:bg-muted/50'}`}>
                          {fmt}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="expectedExamples" className="text-sm text-muted-foreground font-medium">Exemplos esperados (opcional)</Label>
                    <Textarea id="expectedExamples" value={form.expectedExamples} onChange={e => set('expectedExamples', e.target.value)}
                      rows={4} className="bg-input border-border text-sm resize-none" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="specificRules" className="text-sm text-muted-foreground font-medium">Regras específicas (opcional)</Label>
                    <Textarea id="specificRules" value={form.specificRules} onChange={e => set('specificRules', e.target.value)}
                      rows={4} className="bg-input border-border text-sm resize-none" />
                  </div>
                </div>

                {saveError && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> {saveError}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat de teste */}
          <div className="lg:col-span-4">
            <div className="sticky top-8">
              <Card className="bg-card border-border shadow-sm rounded-xl flex flex-col h-[520px] overflow-hidden">
                <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <CardTitle className="text-xs font-semibold">Chat de teste</CardTitle>
                  </div>
                  {messages.length > 0 && (
                    <button onClick={() => { setMessages([]); setConversationId(undefined) }}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                      <RotateCcw className="w-3 h-3" /> Nova
                    </button>
                  )}
                </CardHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10 text-xs min-h-0">
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
                        {msg.role === 'USER' ? <User className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                      <div className={cn(
                        'max-w-[80%] px-3 py-2 rounded-xl text-sm',
                        msg.role === 'USER' ? 'bg-primary text-white rounded-tr-sm'
                          : msg.metadata?.failed ? 'bg-red-950 text-red-300 border border-red-800 rounded-tl-sm'
                          : 'bg-secondary text-foreground rounded-tl-sm',
                      )}>
                        {msg.content}
                        {msg.role === 'ASSISTANT' && msg.metadata?.model && (
                          <p className="text-xs text-muted-foreground mt-1">{msg.metadata.model} · {msg.metadata.tokensUsed}t</p>
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
                <form onSubmit={handleSendMessage} className="p-3 border-t border-border/60 bg-card flex gap-2">
                  <Input placeholder="Digite uma mensagem…" value={chatInput} onChange={e => setChatInput(e.target.value)}
                    disabled={sending || agent.status !== 'ACTIVE'}
                    className="bg-input border-border h-9 text-xs rounded-lg flex-1" />
                  <Button type="submit" size="icon" className="h-9 w-9 bg-gradient-primary text-white rounded-lg"
                    disabled={sending || !chatInput.trim() || agent.status !== 'ACTIVE'}>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>
                {agent.status !== 'ACTIVE' && (
                  <p className="text-xs text-muted-foreground text-center pb-2">Publique o prompt para ativar o agente</p>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Base de Conhecimento ──────────────────────────────────────── */}
      {tab === 'knowledge' && (
        <div className="space-y-4 max-w-4xl">
          <input ref={fileInputRef} type="file" accept=".txt,.pdf" className="hidden" onChange={handleFileUpload} />

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {docs.length === 0 ? 'Nenhum documento ainda' : `${docs.length} documento${docs.length > 1 ? 's' : ''} na base`}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-2" disabled={fetchingYoutube}
                onClick={() => { setShowYoutubeInput(v => !v); setIngestError(null) }}>
                {fetchingYoutube ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4 text-red-500" />}
                {fetchingYoutube ? 'Buscando…' : 'YouTube'}
              </Button>
              <Button size="sm" variant="outline" className="gap-2" disabled={parsing} onClick={() => fileInputRef.current?.click()}>
                {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {parsing ? 'Lendo…' : '.txt / .pdf'}
              </Button>
              {!showAddForm && (
                <Button size="sm" className="gap-2" onClick={() => setShowAddForm(true)}>
                  <Plus className="w-4 h-4" /> Colar texto
                </Button>
              )}
            </div>
          </div>

          {showYoutubeInput && (
            <form onSubmit={handleFetchYoutube} className="flex items-center gap-2">
              <Input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="Cole a URL do vídeo: https://youtube.com/watch?v=…" autoFocus className="flex-1" />
              <Button type="submit" size="sm" disabled={fetchingYoutube || !youtubeUrl.trim()} className="gap-1.5 flex-shrink-0">
                {fetchingYoutube ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                {fetchingYoutube ? 'Buscando…' : 'Buscar transcrição'}
              </Button>
              <button type="button" onClick={() => { setShowYoutubeInput(false); setYoutubeUrl('') }}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </form>
          )}

          {showAddForm && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Novo documento</CardTitle>
                  <button onClick={() => { setShowAddForm(false); setIngestError(null) }}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleIngest} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="doc-title" className="text-sm font-medium">Título</Label>
                      <Input id="doc-title" value={docTitle} onChange={e => setDocTitle(e.target.value)}
                        placeholder="Ex: Script de qualificação SDR" required autoFocus />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Visibilidade</Label>
                      <div className="flex gap-2">
                        {([{ value: 'AGENT', label: 'Só este agente' }, { value: 'TENANT', label: 'Todos os agentes' }] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setDocLayer(opt.value)}
                            className={cn('flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors',
                              docLayer === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-secondary/40')}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="doc-content" className="text-sm font-medium">Conteúdo</Label>
                      <span className="text-xs text-muted-foreground">{docContent.length} caracteres</span>
                    </div>
                    <Textarea id="doc-content" value={docContent} onChange={e => setDocContent(e.target.value)}
                      placeholder="Cole aqui o texto que o agente deve conhecer…"
                      rows={8} required minLength={50} className="font-mono text-sm resize-none" />
                    <p className="text-xs text-muted-foreground">Mínimo 50 caracteres.</p>
                  </div>
                  {ingestError && <p className="text-sm text-destructive">{ingestError}</p>}
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={ingesting || !docTitle.trim() || docContent.trim().length < 50} className="gap-2">
                      {ingesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {ingesting ? 'Processando…' : 'Ingerir documento'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setShowAddForm(false); setIngestError(null) }}>Cancelar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {docsLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 rounded-xl border border-border bg-secondary/30 animate-pulse" />)}
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
                  <Plus className="w-3.5 h-3.5" /> Adicionar primeiro documento
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => (
                <div key={doc.id}
                  className="relative flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 overflow-hidden hover:bg-secondary/20 transition-colors">
                  <div className={cn('absolute left-0 top-0 bottom-0 w-1', STATUS_ACCENT[doc.status] ?? 'bg-muted')} />
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {LAYER_LABELS[doc.layer] ?? doc.layer}
                      </span>
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border', STATUS_COLORS[doc.status] ?? 'bg-muted text-muted-foreground')}>
                        {doc.status}
                      </span>
                      {doc.chunksCount > 0 && (
                        <span className="text-[10px] text-muted-foreground/60">{doc.chunksCount} chunk{doc.chunksCount > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                    {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                  <button onClick={() => handleDeleteDoc(doc.id, doc.title)} disabled={deletingId === doc.id}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 flex-shrink-0">
                    {deletingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
