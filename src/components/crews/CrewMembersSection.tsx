'use client'

import { useState, useCallback, useEffect } from 'react'
import { api, ApiError, type AgentListItem } from '@/lib/api'

export type CrewMember = {
  id: string
  agentId: string
  agentName: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
}

type Props = {
  crewId: string
  members: CrewMember[]
  onRefresh: () => void
}

const ROLE_LABEL: Record<string, string> = {
  DIRECTOR: '🎯 DIRETOR',
  MEMBER: 'MEMBRO',
  OBSERVER: 'OBSERVADOR',
}

const ROLE_COLORS: Record<string, { border: string; badge: string; text: string }> = {
  DIRECTOR: { border: '#7C3AED', badge: 'bg-purple-500/10 text-purple-400', text: 'text-purple-400' },
  MEMBER:   { border: '#06C8E8', badge: 'bg-cyan-500/10 text-cyan-400',    text: 'text-cyan-400' },
  OBSERVER: { border: '#6B7280', badge: 'bg-gray-500/10 text-gray-400',    text: 'text-gray-400' },
}

export function CrewMembersSection({ crewId, members, onRefresh }: Props) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const handleRemove = useCallback(async (memberId: string) => {
    setRemoving(true)
    setRemoveError(null)
    try {
      await api.crews.removeMember(crewId, memberId)
      setConfirmingId(null)
      onRefresh()
    } catch (err) {
      setRemoveError(err instanceof ApiError ? err.message : 'Erro ao remover membro.')
    } finally {
      setRemoving(false)
    }
  }, [crewId, onRefresh])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Membros da Equipe</h3>
          <p className="text-xs text-muted-foreground">{members.length} agente{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#4F6EF7] text-white hover:opacity-90 transition-opacity"
        >
          + Adicionar Agente
        </button>
      </div>

      {removeError && (
        <p className="text-xs text-destructive">{removeError}</p>
      )}

      {members.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
          Nenhum agente adicionado ainda. Clique em "+ Adicionar Agente" para começar.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m) => {
            const colors = ROLE_COLORS[m.role] ?? ROLE_COLORS.OBSERVER
            const isConfirming = confirmingId === m.id
            return (
              <div
                key={m.id}
                className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2.5 border border-border"
                style={{ borderLeft: `3px solid ${colors.border}` }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: `${colors.border}18`, border: `1px solid ${colors.border}40` }}
                  >
                    🤖
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.agentName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${colors.badge}`}>
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                  {isConfirming ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">Remover?</span>
                      <button
                        onClick={() => handleRemove(m.id)}
                        disabled={removing}
                        className="text-destructive font-semibold hover:underline disabled:opacity-50"
                      >
                        {removing ? '...' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setConfirmingId(m.id); setRemoveError(null) }}
                      aria-label={`Remover ${m.agentName} da crew`}
                      className="text-muted-foreground hover:text-destructive transition-colors text-base leading-none px-1"
                      title="Remover da crew"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <AddMemberModal
          crewId={crewId}
          existingMemberAgentIds={members.map((m) => m.agentId)}
          hasDirector={members.some((m) => m.role === 'DIRECTOR')}
          onClose={() => setShowModal(false)}
          onAdded={() => { setShowModal(false); onRefresh() }}
        />
      )}
    </div>
  )
}

type ModalProps = {
  crewId: string
  existingMemberAgentIds: string[]
  hasDirector: boolean
  onClose: () => void
  onAdded: () => void
}

function AddMemberModal({ crewId, existingMemberAgentIds, hasDirector, onClose, onAdded }: ModalProps) {
  const [agents, setAgents] = useState<AgentListItem[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [role, setRole] = useState<'DIRECTOR' | 'MEMBER'>('MEMBER')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.agents.list()
      .then((list) => {
        const available = list.filter((a) => !existingMemberAgentIds.includes(a.id))
        setAgents(available)
        if (available.length > 0) setSelectedAgentId(available[0].id)
      })
      .catch(() => setError('Erro ao carregar agentes.'))
      .finally(() => setLoadingAgents(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd() {
    if (!selectedAgentId) return
    setIsAdding(true)
    setError(null)
    try {
      await api.crews.addMember(crewId, { agentId: selectedAgentId, role, order: 0 })
      onAdded()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao adicionar membro.')
      setIsAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="add-member-modal-title">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="add-member-modal-title" className="text-base font-semibold text-foreground">Adicionar Agente à Crew</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        {loadingAgents ? (
          <p className="text-sm text-muted-foreground">Carregando agentes…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os agentes disponíveis já são membros desta crew.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <label htmlFor="agent-select" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agente</label>
              <select
                id="agent-select"
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4F6EF7]"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.type} ({a.status === 'ACTIVE' ? 'Ativo' : 'Rascunho'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Papel na Crew</label>
              <div className="flex gap-2">
                {(['MEMBER', 'DIRECTOR'] as const).map((r) => {
                  const disabled = r === 'DIRECTOR' && hasDirector
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setRole(r)}
                      title={disabled ? 'Já existe um Diretor nesta equipe' : undefined}
                      className={[
                        'flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors',
                        role === r && !disabled
                          ? r === 'DIRECTOR'
                            ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                            : 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                          : disabled
                          ? 'border-border bg-secondary/20 text-muted-foreground/40 cursor-not-allowed'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary/40',
                      ].join(' ')}
                    >
                      {r === 'DIRECTOR' ? '🎯 Diretor' : 'Membro'}
                    </button>
                  )
                })}
              </div>
              {hasDirector && (
                <p className="text-[11px] text-muted-foreground">Já existe um Diretor nesta equipe.</p>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={isAdding || !selectedAgentId}
                className="flex-1 py-2 rounded-lg bg-[#4F6EF7] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isAdding ? 'Adicionando…' : 'Adicionar'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary/40 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
