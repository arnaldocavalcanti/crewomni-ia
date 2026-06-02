'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

const AGENT_TYPES = [
  { value: 'SDR', label: 'SDR — Prospecção e qualificação' },
  { value: 'HELPDESK', label: 'Helpdesk — Suporte técnico' },
  { value: 'SUPPORT', label: 'Support — Atendimento geral' },
  { value: 'SALES', label: 'Sales — Atendimento comercial' },
  { value: 'NEGOTIATION', label: 'Negotiation — Negociação' },
  { value: 'ONBOARDING', label: 'Onboarding — Integração de clientes' },
]

export default function NewAgentPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', type: '', description: '', systemPrompt: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.type) { setError('Selecione um tipo de agente.'); return }
    setError('')
    setLoading(true)
    try {
      const agent = await api.agents.create({
        name: form.name,
        type: form.type,
        description: form.description.trim() || undefined,
        systemPrompt: form.systemPrompt,
      })
      router.push(`/dashboard/agents/${agent.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar agente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/agents">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Novo agente</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure o comportamento do seu agente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Informações básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm text-muted-foreground">Nome</Label>
              <Input id="name" placeholder="Ex: Suporte Devolus"
                value={form.name} onChange={e => set('name', e.target.value)} required
                className="bg-input border-border" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v ?? '')}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecione o tipo de agente" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {AGENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm text-muted-foreground">
                Descrição <span className="text-muted-foreground/60">(opcional)</span>
              </Label>
              <Input id="description" placeholder="Breve descrição do agente"
                value={form.description} onChange={e => set('description', e.target.value)}
                className="bg-input border-border" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">System Prompt</CardTitle>
            <CardDescription className="text-muted-foreground">
              Instrução base do agente. Define personalidade, tom e comportamento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Você é um assistente especializado em vistorias de imóveis da Devolus. Seu objetivo é…"
              value={form.systemPrompt}
              onChange={e => set('systemPrompt', e.target.value)}
              required
              rows={10}
              className="bg-input border-border font-mono text-sm resize-none"
            />
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/dashboard/agents">
            <Button type="button" variant="outline">Cancelar</Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? 'Criando…' : 'Criar agente'}
          </Button>
        </div>
      </form>
    </div>
  )
}
