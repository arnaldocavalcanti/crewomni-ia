'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, type CrewItem, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Users, Hash, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CrewsPage() {
  const router = useRouter()
  const [crews, setCrews] = useState<CrewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadCrews = useCallback(() => {
    setLoading(true)
    api.crews.list()
      .then(setCrews)
      .catch(() => setCrews([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadCrews() }, [loadCrews])

  async function handleDelete(crew: CrewItem) {
    if (!confirm(`Excluir a equipe "${crew.name}"? Esta ação não pode ser desfeita e falhará se houver membros associados.`)) return
    setActionLoading(crew.id)
    try {
      await api.crews.delete(crew.id)
      setCrews((prev) => prev.filter((d) => d.id !== crew.id))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao excluir.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Crews</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize seus agentes em equipes multifuncionais</p>
        </div>
        <Link href="/dashboard/crews/new">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Crew
          </Button>
        </Link>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : crews.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center h-64 gap-4 border border-dashed border-border rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma crew criada ainda</p>
          <Link href="/dashboard/crews/new">
            <Button size="sm" variant="outline">Criar primeira crew</Button>
          </Link>
        </div>
      ) : (
        /* Grid of cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {crews.map((crew, i) => (
            <div
              key={crew.id}
              className="relative rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-border/80 hover:bg-secondary/30"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Status accent border */}
              <div
                className={cn(
                  'absolute left-0 top-0 bottom-0 w-1',
                  crew.status === 'ACTIVE' ? 'bg-emerald-500' : 
                  crew.status === 'ARCHIVED' ? 'bg-red-500' : 'bg-amber-500',
                )}
              />

              <div className="pl-5 pr-4 py-4 space-y-2">
                {/* Name + status + actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight truncate">{crew.name}</p>
                    <span
                      className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0',
                        crew.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : crew.status === 'ARCHIVED'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-amber-500/10 text-amber-400',
                      )}
                    >
                      {crew.status}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => router.push(`/dashboard/crews/${crew.id}`)}
                      disabled={actionLoading === crew.id}
                      title="Ver e Editar"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(crew)}
                      disabled={actionLoading === crew.id}
                      title="Excluir"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Slug */}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Hash className="w-3 h-3" />
                  <span className="text-xs font-mono">{crew.slug}</span>
                </div>

                {/* Objective */}
                {crew.objective && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{crew.objective}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
