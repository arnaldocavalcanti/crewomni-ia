'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError, DepartmentItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Hash } from 'lucide-react'

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

export default function NewCrewPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const slugPreview = name ? toSlug(name) : null

  useEffect(() => {
    api.departments.list()
      .then(setDepartments)
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      await api.crews.create({
        name: name.trim(),
        departmentId: departmentId || undefined,
        objective: objective.trim() || undefined,
        description: description.trim() || undefined,
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
        <h1 className="text-2xl font-semibold text-foreground">Nova Crew</h1>
        <p className="text-sm text-muted-foreground mt-1">Crie uma nova equipe de agentes autônomos</p>
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

        {/* Department */}
        <div className="space-y-1.5">
          <Label htmlFor="departmentId" className="text-sm font-medium">
            Departamento <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <select
            id="departmentId"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Nenhum (Global)</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
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

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Criando…' : 'Criar Crew'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
