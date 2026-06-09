'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError, type DepartmentItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function EditDepartmentPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const slugPreview = name ? toSlug(name) : null

  useEffect(() => {
    api.departments.get(id)
      .then((dept: DepartmentItem) => {
        setName(dept.name)
        setDescription(dept.description ?? '')
        setStatus(dept.status)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setError('Erro ao carregar department.')
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      await api.departments.update(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      })
      router.push('/dashboard/departments')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.code === 'DEPARTMENT_NAME_TAKEN'
          ? 'Já existe um department com este nome.'
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
          {[1, 2].map((i) => (
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
          href="/dashboard/departments"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Departments
        </Link>
        <p className="text-sm text-destructive">Department não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-lg space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/departments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Departments
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Editar Department</h1>
        <p className="text-sm text-muted-foreground mt-1">Atualize as informações desta área de negócio</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium">
            Nome <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Comercial, Suporte, Financeiro"
            required
            minLength={2}
            maxLength={100}
            autoFocus
          />
          {/* Slug preview */}
          {slugPreview && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="w-3 h-3" />
              <span className="font-mono">{slugPreview}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="description" className="text-sm font-medium">
              Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <span className="text-xs text-muted-foreground">{description.length} / 500</span>
          </div>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva a finalidade deste department"
            maxLength={500}
            rows={3}
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Status</Label>
          <div className="flex gap-2">
            {(['ACTIVE', 'INACTIVE'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors',
                  status === s
                    ? s === 'ACTIVE'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-muted-foreground/40 bg-muted text-muted-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary/40',
                )}
              >
                {s === 'ACTIVE' ? 'Ativo' : 'Inativo'}
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
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Salvando…' : 'Salvar Alterações'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
