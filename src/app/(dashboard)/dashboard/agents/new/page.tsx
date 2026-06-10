'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, AgentRoleItem, DepartmentItem, CrewItem, AgentListItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, Plus, Check, MessageSquare, ShieldAlert, Cpu } from 'lucide-react'

const CATEGORIES = [
  'Comercial',
  'Atendimento',
  'Suporte',
  'Financeiro',
  'Jurídico',
  'RH',
  'Operações',
  'Marketing',
  'Customizado',
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

const MAIN_CHANNELS = [
  'WhatsApp',
  'E-mail',
  'Webchat',
  'API',
  'WhatsApp + E-mail',
]

const AUTONOMY_LEVELS = ['Baixa', 'Média', 'Alta']

const COMMUNICATION_STYLES = [
  'Empático e direto',
  'Conciso e profissional',
  'Detalhado e consultivo',
  'Formal',
]

const TONE_OF_VOICES = [
  'Profissional e consultivo',
  'Amigável e acolhedor',
  'Técnico e formal',
  'Entusiasmado',
]

const OUTPUT_FORMATS = [
  'Texto livre',
  'JSON estruturado',
  'Mensagem WhatsApp',
  'E-mail',
  'Decisão de roteamento',
]

export default function NewAgentPage() {
  const router = useRouter()
  
  // Form State
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Comercial',
    roleId: '',
    operationalFunction: 'Conversacional',
    status: 'ACTIVE',
    
    // Organization
    departmentId: '',
    crewId: '',
    directorId: '',
    mainChannel: 'WhatsApp + E-mail',
    
    // Behavior
    toneOfVoice: 'Profissional e consultivo',
    communicationStyle: 'Empático e direto',
    autonomyLevel: 'Média',
    responsibilities: ['atende_direto', 'analisa_conversas', 'cria_mensagens'] as string[],
    
    // Permissions
    permissionReadKB: true,
    permissionSendWhatsapp: true,
    permissionSendEmail: true,
    permissionExecuteTool: false,
    permissionCallHuman: true,
    permissionCreateTask: true,
    permissionReadHistory: true,
    permissionReadCommercial: true,
    
    // Prompt & Directives
    systemPrompt: '',
    outputFormat: 'Texto livre',
    expectedExamples: '',
    specificRules: '',
  })

  // Dropdown options
  const [roles, setRoles] = useState<AgentRoleItem[]>([])
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [crews, setCrews] = useState<CrewItem[]>([])
  const [agents, setAgents] = useState<AgentListItem[]>([])
  
  // Custom Role Inline State
  const [showNewRoleForm, setShowNewRoleForm] = useState(false)
  const [newRole, setNewRole] = useState({ name: '', category: 'Comercial', description: '' })
  const [creatingRole, setCreatingRole] = useState(false)
  
  // General UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Stub Chat State
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'agent'; text: string; time: string }[]>([
    { sender: 'agent', text: 'Olá! Sou o seu novo agente. Como posso te ajudar hoje?', time: '09:42' }
  ])
  const [chatInput, setChatInput] = useState('')

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [rolesList, deptsList, crewsList, agentsList] = await Promise.all([
          api.agents.roles.list(),
          api.departments.list(),
          api.crews.list(),
          api.agents.list()
        ])
        setRoles(rolesList)
        setDepartments(deptsList)
        setCrews(crewsList)
        setAgents(agentsList)
        
        // Auto select first role if exists
        if (rolesList.length > 0) {
          setForm(f => ({ ...f, roleId: rolesList[0].id }))
        }
      } catch (err) {
        console.error('Erro ao carregar dados do formulário:', err)
      }
    }
    loadData()
  }, [])

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function toggleResponsibility(resp: string) {
    setForm(f => {
      const current = f.responsibilities
      const next = current.includes(resp)
        ? current.filter(r => r !== resp)
        : [...current, resp]
      return { ...f, responsibilities: next }
    })
  }

  // Handle inline role creation
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
    } catch (err: any) {
      alert(err.message || 'Erro ao criar papel personalizado')
    } finally {
      setCreatingRole(false)
    }
  }

  // Handle Form Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.roleId) {
      setError('Por favor, selecione ou crie um papel para o agente.')
      return
    }
    if (form.systemPrompt.trim().length < 10) {
      setError('O System Prompt deve conter pelo menos 10 caracteres.')
      return
    }
    
    setError('')
    setLoading(true)
    try {
      const created = await api.agents.create({
        name: form.name,
        category: form.category,
        roleId: form.roleId,
        operationalFunction: form.operationalFunction,
        description: form.description.trim() || undefined,
        systemPrompt: form.systemPrompt,
        
        departmentId: form.departmentId && form.departmentId !== 'sem-departamento' ? form.departmentId : null,
        directorId: form.directorId && form.directorId !== 'sem-diretor' ? form.directorId : null,
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

      // If crewId is specified, add agent to that crew in background
      if (form.crewId) {
        try {
          await api.crews.addMember(form.crewId, {
            agentId: created.id,
            role: 'MEMBER',
            order: 0,
          })
        } catch (crewErr) {
          console.error('Erro ao vincular agente à crew:', crewErr)
        }
      }

      router.push(`/dashboard/agents/${created.id}`)
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar agente.')
    } finally {
      setLoading(false)
    }
  }

  // Stub Chat handler
  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim()) return
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const userMsg = { sender: 'user' as const, text: chatInput, time }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')

    // Simulate agent typing
    setTimeout(() => {
      const responseTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const namePart = form.name || 'Agente'
      const rolePart = roles.find(r => r.id === form.roleId)?.name || 'Profissional'
      const responseMsg = {
        sender: 'agent' as const,
        text: `Olá! Eu sou o ${namePart} atuando como ${rolePart}. Recebi sua mensagem: "${userMsg.text}". Minha função operacional é "${form.operationalFunction}".`,
        time: responseTime
      }
      setChatMessages(prev => [...prev, responseMsg])
    }, 1000)
  }

  // Derived Preview Text fields
  const selectedRoleName = roles.find(r => r.id === form.roleId)?.name || 'Selecione um papel'
  const selectedDeptName = departments.find(d => d.id === form.departmentId)?.name || 'Não vinculado'
  const selectedCrewName = crews.find(c => c.id === form.crewId)?.name || 'Não vinculado'
  const selectedDirectorName = agents.find(a => a.id === form.directorId)?.name || 'Nenhum'

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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Novo agente</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Configure um profissional digital para sua crew</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/agents">
            <Button variant="outline" type="button" className="border-border">Cancelar</Button>
          </Link>
          <Button onClick={handleSubmit} type="button" variant="gradient" disabled={loading}>
            {loading ? 'Criando…' : 'Criar agente'}
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Form Blocks */}
        <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-6">
          
          {/* Bloco 1: Identidade do Agente */}
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
                  <Input id="name" placeholder="Ex: Devolus Follow-up Hunter"
                    value={form.name} onChange={e => set('name', e.target.value)} required
                    className="bg-input border-border h-10 rounded-lg" />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-sm text-muted-foreground font-medium">Descrição curta</Label>
                  <Input id="description" placeholder="Especialista em reativação comercial"
                    value={form.description} onChange={e => set('description', e.target.value)}
                    className="bg-input border-border h-10 rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground font-medium">Categoria *</Label>
                  <Select value={form.category} onValueChange={(v) => set('category', v)}>
                    <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
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
                  <Select value={form.roleId} onValueChange={(v) => set('roleId', v)}>
                    <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                      <SelectValue placeholder="Selecione o papel">
                        {form.roleId
                          ? (roles.find(r => r.id === form.roleId)?.name ?? 'Selecione o papel')
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border min-w-[280px]">
                      {roles.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} {r.tenantId ? '(Custom)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Inline Custom Role Form */}
              {showNewRoleForm && (
                <div className="p-4 bg-muted/40 border border-dashed border-border rounded-xl space-y-4 transition mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-color-purple">Novo papel personalizado</span>
                    <button type="button" onClick={() => setShowNewRoleForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome do papel *</Label>
                      <Input placeholder="Ex: Especialista em Reativação Proativa"
                        value={newRole.name} onChange={e => setNewRole(r => ({ ...r, name: e.target.value }))}
                        className="bg-input border-border h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Categoria *</Label>
                      <Select value={newRole.category} onValueChange={(v) => setNewRole(r => ({ ...r, category: v || '' }))}>
                        <SelectTrigger className="bg-input border-border h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {CATEGORIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground font-medium">Descrição</Label>
                    <Textarea placeholder="Descreva os objetivos principais do papel..."
                      value={newRole.description} onChange={e => setNewRole(r => ({ ...r, description: e.target.value }))}
                      rows={2} className="bg-input border-border text-sm" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowNewRoleForm(false)}>Cancelar</Button>
                    <Button type="button" variant="default" size="sm" onClick={handleCreateRole} disabled={creatingRole || !newRole.name.trim()}>
                      {creatingRole ? 'Salvando…' : 'Salvar papel'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground font-medium">Função operacional *</Label>
                  <Select value={form.operationalFunction} onValueChange={(v) => set('operationalFunction', v)}>
                    <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                      <SelectValue placeholder="Selecione a função">
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
                  <Select value={form.status} onValueChange={(v) => set('status', v)}>
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
                <Select value={form.departmentId} onValueChange={(v) => set('departmentId', v)}>
                  <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                    <SelectValue placeholder="Selecione o departamento">
                      {form.departmentId === 'sem-departamento'
                        ? 'Nenhum'
                        : form.departmentId
                          ? (departments.find(d => d.id === form.departmentId)?.name ?? 'Selecione')
                          : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="sem-departamento">Nenhum</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground font-medium">Crew</Label>
                <Select value={form.crewId} onValueChange={(v) => set('crewId', v)}>
                  <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                    <SelectValue placeholder="Vincular a uma crew">
                      {form.crewId && form.crewId !== 'sem-crew'
                        ? (crews.find(c => c.id === form.crewId)?.name ?? form.crewId)
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="sem-crew">Nenhum</SelectItem>
                    {crews
                      .filter(c => !form.departmentId || form.departmentId === 'sem-departamento' || c.departmentId === form.departmentId)
                      .map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground font-medium">Diretor responsável</Label>
                <Select value={form.directorId} onValueChange={(v) => set('directorId', v)}>
                  <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                    <SelectValue placeholder="Diretor supervisor">
                      {form.directorId && form.directorId !== 'sem-diretor'
                        ? (agents.find(a => a.id === form.directorId)?.name ?? form.directorId)
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="sem-diretor">Nenhum</SelectItem>
                    {agents.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground font-medium">Canal principal</Label>
                <Select value={form.mainChannel} onValueChange={(v) => set('mainChannel', v)}>
                  <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {MAIN_CHANNELS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Bloco 3: Comportamento e Autonomia */}
          <Card className="bg-card border-border shadow-sm rounded-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Comportamento e autonomia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground font-medium">Tom de voz</Label>
                  <Select value={form.toneOfVoice} onValueChange={(v) => set('toneOfVoice', v)}>
                    <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {TONE_OF_VOICES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground font-medium">Estilo de comunicação</Label>
                  <Select value={form.communicationStyle} onValueChange={(v) => set('communicationStyle', v)}>
                    <SelectTrigger className="bg-input border-border h-10 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {COMMUNICATION_STYLES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
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
                        className={`flex-1 h-10 rounded-lg text-sm font-medium border transition ${
                          active
                            ? 'bg-gradient-primary text-white border-transparent shadow-sm'
                            : 'bg-input text-muted-foreground border-border hover:bg-muted/50'
                        }`}>
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

          {/* Bloco 4: Permissões e ferramentas */}
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
                  <div key={perm.id}
                    onClick={() => set(perm.id, !isOn)}
                    className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-all ${
                      isOn
                        ? 'bg-[var(--color-blue)]/8 border-[var(--color-blue)]/30'
                        : 'bg-input/40 border-border hover:bg-muted/60'
                    }`}>
                    <span className={`text-sm font-medium transition-colors ${
                      isOn ? 'text-[var(--color-blue)]' : 'text-muted-foreground'
                    }`}>{perm.label}</span>
                    <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                      isOn ? 'bg-[var(--color-blue)]' : 'bg-gray-300'
                    }`}>
                      <div className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        isOn ? 'translate-x-[22px]' : 'translate-x-[3px]'
                      }`} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Bloco 5: System Prompt e instruções */}
          <Card className="bg-card border-border shadow-sm rounded-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">System Prompt e instruções</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">Instruções comportamentais, restrições e regras para o agente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="systemPrompt" className="text-sm text-muted-foreground font-medium">System Prompt (instruções base) *</Label>
                  <span className="text-xs text-muted-foreground">{form.systemPrompt.length} caracteres</span>
                </div>
                <Textarea id="systemPrompt" placeholder="Você é um profissional digital especializado em..."
                  value={form.systemPrompt} onChange={e => set('systemPrompt', e.target.value)} required
                  className="bg-input border-border font-mono text-sm resize-y min-h-[200px] max-h-[500px] overflow-y-auto" />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground font-medium">Formato de saída</Label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {OUTPUT_FORMATS.map(fmt => {
                    const active = form.outputFormat === fmt
                    return (
                      <button key={fmt} type="button" onClick={() => set('outputFormat', fmt)}
                        className={`h-10 rounded-lg text-xs font-semibold border transition ${
                          active
                            ? 'bg-gradient-primary text-white border-transparent shadow-sm'
                            : 'bg-input text-muted-foreground border-border hover:bg-muted/50'
                        }`}>
                        {fmt}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="expectedExamples" className="text-sm text-muted-foreground font-medium">Exemplos esperados (opcional)</Label>
                  <Textarea id="expectedExamples" placeholder="Ex: Reativação amigável, convite para demonstração..."
                    value={form.expectedExamples} onChange={e => set('expectedExamples', e.target.value)}
                    rows={4} className="bg-input border-border text-sm resize-none" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="specificRules" className="text-sm text-muted-foreground font-medium">Regras específicas (opcional)</Label>
                  <Textarea id="specificRules" placeholder="Ex: Nunca prometer desconto. Sempre validar o interesse..."
                    value={form.specificRules} onChange={e => set('specificRules', e.target.value)}
                    rows={4} className="bg-input border-border text-sm resize-none" />
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> {error}
            </p>
          )}
        </form>

        {/* Right Side: Visual Preview Sticky Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-8 space-y-6">
            
            {/* Realtime Agent Card Summary */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-wider text-color-purple">Preview do agente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground font-medium">Nome</span>
                  <span className="text-foreground font-bold">{form.name || 'Sem nome'}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground font-medium">Categoria</span>
                  <span className="text-foreground font-semibold px-2 py-0.5 rounded bg-color-cyan/15 text-xs text-color-cyan font-bold uppercase">{form.category}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground font-medium">Papel</span>
                  <span className="text-foreground font-semibold text-color-purple font-bold">{selectedRoleName}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground font-medium">Função operacional</span>
                  <span className="text-foreground">{form.operationalFunction}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground font-medium">Departamento</span>
                  <span className="text-foreground">{selectedDeptName}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground font-medium">Crew</span>
                  <span className="text-foreground">{selectedCrewName}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground font-medium">Diretor responsável</span>
                  <span className="text-foreground">{selectedDirectorName}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground font-medium">Canais</span>
                  <span className="text-foreground font-medium text-color-blue">{form.mainChannel}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-muted-foreground font-medium">Status</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${form.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {form.status === 'ACTIVE' ? 'Ativo' : 'Rascunho'}
                  </span>
                </div>
                
                {/* Enabled Permissions Chips */}
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

            {/* Crew Visual Handoff Chain */}
            <Card className="bg-card border-border shadow-sm rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold">Fluxo na crew (Handoff)</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2 overflow-x-auto py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 border border-border rounded-lg shrink-0">
                  <span>SDR</span>
                </div>
                <span>→</span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 border border-border rounded-lg shrink-0">
                  <span>Strategist</span>
                </div>
                <span>→</span>
                <div className="flex items-center gap-1.5 text-xs text-white bg-gradient-primary px-3 py-1.5 rounded-lg shrink-0 font-semibold shadow-sm">
                  <span>{form.name || 'Agente'}</span>
                </div>
                <span>→</span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 border border-border rounded-lg shrink-0">
                  <span>Closer Humano</span>
                </div>
              </CardContent>
            </Card>

            {/* Interactive Chat Test Container */}
            <Card className="bg-card border-border shadow-sm rounded-xl flex flex-col h-80 overflow-hidden">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <CardTitle className="text-xs font-semibold">Chat de teste (Rascunho)</CardTitle>
                </div>
                <button type="button" onClick={() => setChatMessages([{ sender: 'agent', text: 'Olá! Sou o seu novo agente. Como posso te ajudar hoje?', time: '09:42' }])}
                  className="text-[10px] text-muted-foreground hover:text-foreground">Limpar</button>
              </CardHeader>
              
              {/* Message History area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10 text-xs">
                {chatMessages.map((msg, index) => (
                  <div key={index} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      msg.sender === 'user'
                        ? 'bg-gradient-primary text-white rounded-tr-none'
                        : 'bg-muted/40 border border-border/80 text-foreground rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-muted-foreground/60 mt-1 px-1">{msg.time}</span>
                  </div>
                ))}
              </div>

              {/* Message Input Box */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-border/60 bg-card flex gap-2">
                <Input placeholder="Digite uma mensagem de teste..."
                  value={chatInput} onChange={e => setChatInput(e.target.value)}
                  className="bg-input border-border h-9 text-xs rounded-lg flex-1" />
                <Button type="submit" size="icon" className="h-9 w-9 bg-gradient-primary text-white rounded-lg">
                  <MessageSquare className="w-3.5 h-3.5" />
                </Button>
              </form>
            </Card>

          </div>
        </div>

      </div>
    </div>
  )
}
