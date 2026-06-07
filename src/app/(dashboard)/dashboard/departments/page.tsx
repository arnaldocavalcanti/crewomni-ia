'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, type DepartmentItem, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Building2, Hash, Pencil, Plus, PowerOff, Power, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DepartmentsPage() {
  const router = useRouter()
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadDepartments = useCallback(() => {
    setLoading(true)
    api.departments.list()
      .then(setDepartments)
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadDepartments() }, [loadDepartments])

  async function handleToggleStatus(dept: DepartmentItem) {
    setActionLoading(dept.id)
    try {
      const updated = await api.departments.update(dept.id, {
        status: dept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      })
      setDepartments((prev) => prev.map((d) => d.id === updated.id ? updated : d))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao alterar status.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(dept: DepartmentItem) {
    if (!confirm(`Excluir o department "${dept.name}"? Esta ação não pode ser desfeita.`)) return
    setActionLoading(dept.id)
    try {
      await api.departments.delete(dept.id)
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id))
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
          <h1 className="text-2xl font-semibold text-foreground">Departments</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize seus agentes em áreas de negócio</p>
        </div>
        <Link href="/dashboard/departments/new">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Department
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
      ) : departments.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center h-64 gap-4 border border-dashed border-border rounded-xl">
          <Building2 className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum department criado ainda</p>
          <Link href="/dashboard/departments/new">
            <Button size="sm" variant="outline">Criar primeiro department</Button>
          </Link>
        </div>
      ) : (
        /* Grid of cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept, i) => (
            <div
              key={dept.id}
              className="relative rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-border/80 hover:bg-secondary/30"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Status accent border */}
              <div
                className={cn(
                  'absolute left-0 top-0 bottom-0 w-1',
                  dept.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                )}
              />

              <div className="pl-5 pr-4 py-4 space-y-2">
                {/* Name + status + actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight truncate">{dept.name}</p>
                    <span
                      className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0',
                        dept.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {dept.status}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => router.push(`/dashboard/departments/${dept.id}/edit`)}
                      disabled={actionLoading === dept.id}
                      title="Editar"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(dept)}
                      disabled={actionLoading === dept.id}
                      title={dept.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                      className={cn(
                        'p-1.5 rounded-md transition-colors disabled:opacity-40',
                        dept.status === 'ACTIVE'
                          ? 'text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10'
                          : 'text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10',
                      )}
                    >
                      {dept.status === 'ACTIVE'
                        ? <PowerOff className="w-3.5 h-3.5" />
                        : <Power className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(dept)}
                      disabled={actionLoading === dept.id}
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
                  <span className="text-xs font-mono">{dept.slug}</span>
                </div>

                {/* Description */}
                {dept.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{dept.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
