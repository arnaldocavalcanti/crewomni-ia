'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError, type DepartmentItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Hash } from 'lucide-react'

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

export default function NewCrewPage() {
  const router = useRouter()
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [name, setName]               = useState('')
  const [objective, setObjective]     = useState('')
  const [description, setDescription] = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    api.departments.list()
      .then((depts) => {
        setDepartments(depts)
        if (depts.length > 0) setDepartmentId(depts[0].id)
      })
      .catch(() => setDepartments([]))
  }, [])

  const slugPreview = name ? toSlug(name) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !departmentId) return
    setError(null)
    setSubmitting(true)
    try {
      const crew = await api.crews.create({
        departmentId,
        name: name.trim(),
        objective: objective.trim() || undefined,
        description: description.trim() || undefined,
      })
      router.push(`/dashboard/crews/${crew.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.code === 'CREW_NAME_TAKEN'
          ? 'Já existe uma crew com este nome.'
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
      <Link
        href="/dashboard/crews"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Crews
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Nova Crew</h1>
        <p className="text-sm text-muted-foreground mt-1">Crie uma equipe de agentes com objetivo comum</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">
            Departamento <span className="text-destructive">*</span>
          </Label>
          <Select value={departmentId} onValueChange={setDepartmentId} disabled={departments.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={departments.length === 0 ? 'Carregando…' : 'Selecione um departamento'} />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium">
            Nome <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Comercial IA, Helpdesk, Onboarding"
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

        <div className="space-y-1.5">
          <Label htmlFor="objective" className="text-sm font-medium">
            Objetivo <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Ex: Qualificação e fechamento de leads"
            maxLength={500}
          />
        </div>

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
            placeholder="Descreva a finalidade desta crew"
            maxLength={500}
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={submitting || !name.trim() || !departmentId}>
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
