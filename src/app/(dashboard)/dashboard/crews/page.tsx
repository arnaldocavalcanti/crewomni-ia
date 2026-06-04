'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, type CrewItem, type DepartmentItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Hash, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CrewsPage() {
  const [crews, setCrews]             = useState<CrewItem[]>([])
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [activeTab, setActiveTab]     = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    api.departments.list()
      .then(setDepartments)
      .catch(() => setDepartments([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    api.crews.list(activeTab ?? undefined)
      .then(setCrews)
      .catch(() => setCrews([]))
      .finally(() => setLoading(false))
  }, [activeTab])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Crews</h1>
          <p className="text-sm text-muted-foreground mt-1">Equipes de agentes organizadas por departamento</p>
        </div>
        <Link href="/dashboard/crews/new">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Crew
          </Button>
        </Link>
      </div>

      {/* Department tabs */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setActiveTab(null)}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm transition-colors',
            activeTab === null
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
          )}
        >
          Todos
        </button>
        {departments.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveTab(d.id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm transition-colors',
              activeTab === d.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
          >
            {d.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-xl border border-border bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : crews.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 border border-dashed border-border rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma crew criada ainda</p>
          <Link href="/dashboard/crews/new">
            <Button size="sm" variant="outline">Criar primeira crew</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {crews.map((crew, i) => {
            const dept = departments.find((d) => d.id === crew.departmentId)
            return (
              <Link key={crew.id} href={`/dashboard/crews/${crew.id}`}>
                <div
                  className="relative rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-border/80 hover:bg-secondary/30 cursor-pointer h-full"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div
                    className={cn(
                      'absolute left-0 top-0 bottom-0 w-1',
                      crew.status === 'ACTIVE'
                        ? 'bg-emerald-500'
                        : crew.status === 'DRAFT'
                          ? 'bg-amber-500'
                          : 'bg-muted-foreground/30',
                    )}
                  />
                  <div className="pl-5 pr-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-tight">{crew.name}</p>
                      <span
                        className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0',
                          crew.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : crew.status === 'DRAFT'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {crew.status}
                      </span>
                    </div>
                    {dept && <p className="text-xs text-muted-foreground">{dept.name}</p>}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Hash className="w-3 h-3" />
                      <span className="text-xs font-mono">{crew.slug}</span>
                    </div>
                    {crew.objective && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{crew.objective}</p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
