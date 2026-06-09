'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError, type CrewItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import VisualWorkflowBuilder from '@/components/crews/VisualWorkflowBuilder'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function EditCrewPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>('DRAFT')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const slugPreview = name ? toSlug(name) : null

  useEffect(() => {
    api.crews.get(id as string)
      .then((res) => {
        const crew = res.crew
        setName(crew.name)
        setObjective(crew.objective ?? '')
        setDescription(crew.description ?? '')
        setStatus(crew.status)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setError('Erro ao carregar crew.')
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name?.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      await api.crews.update(id as string, {
        name: name.trim(),
        objective: objective.trim() || undefined,
        description: description.trim() || undefined,
        status,
      })
      router.push('/dashboard/crews')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.code === 'CREW_NAME_TAKEN'
          ? 'Já existe uma equipe com este nome.'
          : err.message)
      } else {
        setError('Erro inesperado. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-lg space-y-6">
        <div className="h-4 w-24 rounded bg-secondary/50 animate-pulse" />
        <div className="h-8 w-48 rounded bg-secondary/50 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-secondary/30 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-8 max-w-lg space-y-4">
        <Link
          href="/dashboard/crews"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Crews
        </Link>
        <p className="text-sm text-destructive">Equipe não encontrada.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-lg space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/crews"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Crews
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Editar Crew</h1>
        <p className="text-sm text-muted-foreground mt-1">Atualize as informações desta equipe</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium">
            Nome da Equipe <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Time Comercial, Esquadrão de Suporte"
            required
            minLength={2}
            maxLength={100}
            autoFocus
          />
          {slugPreview && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="w-3 h-3" />
              <span className="font-mono">{slugPreview}</span>
            </div>
          )}
        </div>

        {/* Objective */}
        <div className="space-y-1.5">
          <Label htmlFor="objective" className="text-sm font-medium">
            Objetivo (Instrução da Equipe) <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Ex: Qualificar leads MQL e agendar reunião"
            maxLength={255}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="description" className="text-sm font-medium">
              Descrição Interna <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <span className="text-xs text-muted-foreground">{description.length} / 500</span>
          </div>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Anotações internas sobre esta equipe..."
            maxLength={500}
            rows={3}
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Status</Label>
          <div className="flex gap-2">
            {(['DRAFT', 'ACTIVE', 'ARCHIVED'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  'flex-1 py-2 px-2 text-center rounded-lg border text-xs font-medium transition-colors',
                  status === s
                    ? s === 'ACTIVE'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : s === 'ARCHIVED'
                      ? 'border-red-500 bg-red-500/10 text-red-400'
                      : 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary/40',
                )}
              >
                {s === 'ACTIVE' ? 'Ativo' : s === 'ARCHIVED' ? 'Arquivado' : 'Rascunho'}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={submitting || !name?.trim()}>
            {submitting ? 'Salvando…' : 'Salvar Alterações'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>

      <div className="pt-8 mt-8 border-t border-border">
        <VisualWorkflowBuilder crewId={id as string} />
      </div>
    </div>
  )
}
