'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { setAccessToken } from '@/lib/auth'
import { Users, Bot, MessageSquare } from 'lucide-react'

const FEATURES = [
  { icon: Users, text: 'Crews ilimitados para sua equipe' },
  { icon: Bot, text: 'Agentes de IA especializados' },
  { icon: MessageSquare, text: 'Conversas em tempo real' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { accessToken } = await api.auth.login(email, password)
      setAccessToken(accessToken)
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciais inválidas.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — hidden on mobile */}
      <div className="hidden md:flex md:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden bg-[#F5F7FF]">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ background: 'var(--gradient-primary)' }}
        />
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'var(--gradient-primary)', filter: 'blur(60px)' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'var(--gradient-primary)', filter: 'blur(60px)' }}
        />

        <div className="relative z-10 max-w-xs text-center space-y-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            <div>
              <span className="font-bold text-2xl text-foreground">crewomni</span>
              <span
                className="font-bold text-2xl"
                style={{
                  background: 'var(--gradient-primary)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                .ia
              </span>
            </div>
          </div>

          <p className="text-lg font-medium text-foreground leading-relaxed">
            Orquestre equipes de IA com inteligência.
          </p>

          <ul className="space-y-3 text-left">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[var(--color-blue)]" />
                </div>
                <span className="text-sm text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-2 md:hidden">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl text-foreground">crewomni.ia</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">Bem-vindo de volta</h1>
            <p className="text-sm text-muted-foreground mt-1">Entre na sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" variant="gradient" className="w-full h-10" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{' '}
            <a href="#" className="font-medium text-[var(--color-blue)] hover:underline">
              Criar conta grátis
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
