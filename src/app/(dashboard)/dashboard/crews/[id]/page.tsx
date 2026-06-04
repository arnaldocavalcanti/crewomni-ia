'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api, ApiError, type CrewItem, type CrewMemberItem, type AgentListItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowLeft, Plus, Star, Trash2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type CrewStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
type MemberRole = 'DIRECTOR' | 'MEMBER' | 'OBSERVER'

const STATUS_COLORS: Record<CrewStatus, string> = {
  DRAFT:    'bg-amber-500/10 text-amber-400',
  ACTIVE:   'bg-emerald-500/10 text-emerald-400',
  INACTIVE: 'bg-muted text-muted-foreground',
}

const ROLE_COLORS: Record<MemberRole, string> = {
  DIRECTOR: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  MEMBER:   'bg-secondary text-muted-foreground',
  OBSERVER: 'bg-secondary text-muted-foreground',
}

export default function CrewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [crew, setCrew]       = useState<CrewItem | null>(null)
  const [members, setMembers] = useState<CrewMemberItem[]>([])
  const [agents, setAgents]   = useState<AgentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const [modalOpen, setModalOpen]         = useState(false)
  const [addAgentId, setAddAgentId]       = useState('')
  const [addRole, setAddRole]             = useState<MemberRole>('MEMBER')
  const [addOrder, setAddOrder]           = useState(0)
  const [addError, setAddError]           = useState<string | null>(null)
  const [addSubmitting, setAddSubmitting] = useState(false)

  const loadCrew = useCallback(async () => {
    try {
      const data = await api.crews.get(id)
      setCrew(data.crew)
      setMembers(data.members)
    } catch {
      setError('Crew não encontrada.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadCrew() }, [loadCrew])

  useEffect(() => {
    api.agents.list()
      .then(setAgents)
      .catch(() => setAgents([]))
  }, [])

  function openModal() {
    setAddAgentId('')
    setAddRole('MEMBER')
    setAddOrder(members.length)
    setAddError(null)
    setModalOpen(true)
  }

  async function handleAddMember() {
    if (!addAgentId) return
    setAddError(null)
    setAddSubmitting(true)
    try {
      await api.crews.addMember(id, { agentId: addAgentId, role: addRole, order: addOrder })
      setModalOpen(false)
      await loadCrew()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CREW_ALREADY_HAS_DIRECTOR') setAddError('Esta crew já possui um Director.')
        else if (err.code === 'AGENT_ALREADY_IN_CREW')  setAddError('Este agente já está nesta crew.')
        else setAddError(err.message)
      } else {
        setAddError('Erro inesperado. Tente novamente.')
      }
    } finally {
      setAddSubmitting(false)
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!window.confirm('Remover este agente da crew?')) return
    try {
      await api.crews.removeMember(id, memberId)
      await loadCrew()
    } catch { /* ignore */ }
  }

  async function handleStatusChange(status: CrewStatus) {
    if (!crew) return
    try {
      const updated = await api.crews.update(id, { status })
      setCrew(updated)
    } catch { /* ignore */ }
  }

  const memberAgentIds = new Set(members.map((m) => m.agentId))
  const availableAgents = agents.filter((a) => !memberAgentIds.has(a.id))

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
  if (error || !crew) return <div className="p-8 text-sm text-destructive">{error ?? 'Crew não encontrada.'}</div>

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <Link
        href="/dashboard/crews"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Crews
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">{crew.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">#{crew.slug}</p>
          {crew.objective && <p className="text-sm text-muted-foreground">{crew.objective}</p>}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', STATUS_COLORS[crew.status as CrewStatus])}>
                {crew.status}
              </span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(['DRAFT', 'ACTIVE', 'INACTIVE'] as CrewStatus[]).map((s) => (
              <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)} disabled={s === crew.status}>
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Membros{members.length > 0 && <span className="text-muted-foreground font-normal ml-1">({members.length})</span>}
          </h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={openModal}>
            <Plus className="w-4 h-4" />
            Adicionar Agente
          </Button>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 border border-dashed border-border rounded-xl">
            <p className="text-sm text-muted-foreground">Nenhum membro — adicione agentes para compor a crew</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
            {members.map((m) => {
              const agent = agents.find((a) => a.id === m.agentId)
              const isDirector = m.role === 'DIRECTOR'
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-secondary/30 transition-colors">
                  <div className="w-6 text-center flex-shrink-0">
                    {isDirector
                      ? <Star className="w-4 h-4 text-amber-400 mx-auto" />
                      : <span className="text-xs text-muted-foreground">{m.order}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{agent?.name ?? m.agentId}</p>
                    {agent?.type && <p className="text-xs text-muted-foreground">{agent.type}</p>}
                  </div>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', ROLE_COLORS[m.role as MemberRole])}>
                    {m.role}
                  </span>
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    title="Remover membro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Agente à Crew</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Agente <span className="text-destructive">*</span>
              </Label>
              <Select value={addAgentId} onValueChange={setAddAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente" />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.length === 0
                    ? <SelectItem value="_none" disabled>Todos os agentes já estão na crew</SelectItem>
                    : availableAgents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Papel</Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as MemberRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECTOR">DIRECTOR — Orquestra a crew</SelectItem>
                  <SelectItem value="MEMBER">MEMBER — Agente ativo</SelectItem>
                  <SelectItem value="OBSERVER">OBSERVER — Monitora sem agir</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="order" className="text-sm font-medium">Ordem no workflow</Label>
              <input
                id="order"
                type="number"
                min={0}
                value={addOrder}
                onChange={(e) => setAddOrder(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {addError && <p className="text-sm text-destructive">{addError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddMember} disabled={addSubmitting || !addAgentId}>
              {addSubmitting ? 'Adicionando…' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
