# UI Redesign — Gradient Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o sistema visual atual (dark, Geist Sans, sem identidade) pelo design system Gradient Shell — claro por padrão, paleta ciano→azul→roxo derivada do logo crewomni.ia, Inter como fonte, sidebar redesenhada, login split, empty states, theme toggle e onboarding wizard.

**Architecture:** Mudanças puramente de UI — nenhuma lógica de negócio ou API é alterada. Os tokens de cor vivem em `globals.css` (Tailwind v4, sem `tailwind.config.ts`). Componentes novos (`EmptyState`, `ThemeToggle`) seguem o padrão existente de `/components/ui/`. O onboarding usa `localStorage` para controlar firstLogin e é renderizado no `DashboardLayout`.

**Tech Stack:** Next.js 15 App Router, Tailwind v4, shadcn/base-ui components, CVA, Inter via `next/font/google`, `localStorage` para dark mode e firstLogin.

---

## Mapa de Arquivos

| Arquivo | Ação |
|---|---|
| `src/app/globals.css` | Modificar — substituir tokens de cor, adicionar variáveis do gradiente |
| `src/app/layout.tsx` | Modificar — trocar Geist Sans → Inter, remover classe `dark` forçada |
| `src/app/(dashboard)/dashboard/layout.tsx` | Modificar — redesign completo da sidebar + drawer mobile + onboarding |
| `src/app/(auth)/login/page.tsx` | Modificar — redesign split layout |
| `src/app/(dashboard)/dashboard/page.tsx` | Modificar — atualizar cards com novos tokens |
| `src/components/ui/button.tsx` | Modificar — adicionar variante `gradient` |
| `src/components/ui/input.tsx` | Modificar — focus ring azul, label uppercase |
| `src/components/ui/badge.tsx` | Modificar — cores de status alinhadas ao spec |
| `src/components/ui/empty-state.tsx` | Criar — componente de empty state padrão |
| `src/components/ui/theme-toggle.tsx` | Criar — toggle claro/escuro com localStorage |
| `src/components/onboarding/OnboardingWizard.tsx` | Criar — wizard 3 passos firstLogin |

---

## Task 1: Design Tokens — globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Substituir o bloco `:root` com os novos tokens**

Localize o bloco `:root { ... }` atual e substitua-o por:

```css
:root {
  /* Brand gradient */
  --gradient-primary: linear-gradient(135deg, #06C8E8 0%, #4F6EF7 50%, #7C3AED 100%);
  --color-cyan: #06C8E8;
  --color-blue: #4F6EF7;
  --color-purple: #7C3AED;

  /* Surfaces */
  --background: oklch(0.974 0.008 265);       /* #F5F7FF */
  --foreground: oklch(0.09 0.03 275);          /* #0F0E2A navy */
  --card: oklch(1 0 0);                        /* white */
  --card-foreground: oklch(0.09 0.03 275);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.09 0.03 275);

  /* Brand primary → blue */
  --primary: oklch(0.55 0.22 262);             /* #4F6EF7 */
  --primary-foreground: oklch(1 0 0);

  /* Neutrals */
  --secondary: oklch(0.96 0.005 265);
  --secondary-foreground: oklch(0.09 0.03 275);
  --muted: oklch(0.96 0.005 265);
  --muted-foreground: oklch(0.50 0.01 270);    /* #6B7280 */
  --accent: oklch(0.94 0.015 262);
  --accent-foreground: oklch(0.55 0.22 262);

  /* Feedback */
  --destructive: oklch(0.577 0.245 27.325);

  /* Borders & inputs */
  --border: oklch(0.91 0.012 265);             /* #E8ECF4 */
  --input: oklch(0.91 0.012 265);
  --ring: oklch(0.55 0.22 262);                /* blue focus ring */

  /* Sidebar */
  --sidebar: oklch(1 0 0);                     /* white */
  --sidebar-foreground: oklch(0.09 0.03 275);
  --sidebar-primary: oklch(0.55 0.22 262);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.94 0.015 262);
  --sidebar-accent-foreground: oklch(0.55 0.22 262);
  --sidebar-border: oklch(0.91 0.012 265);
  --sidebar-ring: oklch(0.55 0.22 262);

  /* Charts (mantidos) */
  --chart-1: oklch(0.55 0.22 262);
  --chart-2: oklch(0.55 0.18 300);
  --chart-3: oklch(0.60 0.20 190);
  --chart-4: oklch(0.65 0.15 262);
  --chart-5: oklch(0.70 0.10 300);

  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.075 0.025 275);        /* #0D0C1A */
  --foreground: oklch(0.96 0.01 265);          /* #F0EFFF */
  --card: oklch(0.11 0.03 275);               /* #1A1830 */
  --card-foreground: oklch(0.96 0.01 265);
  --popover: oklch(0.11 0.03 275);
  --popover-foreground: oklch(0.96 0.01 265);
  --primary: oklch(0.55 0.22 262);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.14 0.03 275);
  --secondary-foreground: oklch(0.96 0.01 265);
  --muted: oklch(0.14 0.03 275);
  --muted-foreground: oklch(0.60 0.01 270);
  --accent: oklch(0.17 0.04 275);
  --accent-foreground: oklch(0.75 0.15 262);
  --destructive: oklch(0.65 0.22 27);
  --border: oklch(0.19 0.04 275);             /* #2D2B45 */
  --input: oklch(0.19 0.04 275);
  --ring: oklch(0.55 0.22 262);
  --sidebar: oklch(0.085 0.028 275);          /* #13111F */
  --sidebar-foreground: oklch(0.96 0.01 265);
  --sidebar-primary: oklch(0.55 0.22 262);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.17 0.04 275);
  --sidebar-accent-foreground: oklch(0.75 0.15 262);
  --sidebar-border: oklch(0.19 0.04 275);
  --sidebar-ring: oklch(0.55 0.22 262);
}
```

- [ ] **Step 2: Adicionar classe utilitária para gradiente primário**

Ao final de `globals.css`, adicione:

```css
.bg-gradient-primary {
  background: var(--gradient-primary);
}

.text-gradient-primary {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.border-gradient-primary {
  border-image: var(--gradient-primary) 1;
}
```

- [ ] **Step 3: Verificar que o CSS compila sem erros**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npm run build 2>&1 | tail -20
```

Esperado: sem erros de CSS. Avisos de TypeScript sobre arquivos de página ainda não atualizados são OK.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): replace color tokens with Gradient Shell palette"
```

---

## Task 2: Fonte Inter + Remover Dark Mode Forçado

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Substituir o conteúdo de `layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'CrewOmni',
  description: 'Plataforma de agentes de IA corporativos',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground font-sans">{children}</body>
    </html>
  )
}
```

Nota: a classe `dark` foi removida — o ThemeToggle (Task 6) vai adicioná-la dinamicamente via JS.

- [ ] **Step 2: Verificar que o build continua limpo**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(ui): switch font to Inter, remove forced dark mode"
```

---

## Task 3: Botão — Variante Gradient

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Adicionar variante `gradient` ao CVA**

Substitua o bloco `variants.variant` existente por:

```ts
variant: {
  default: "bg-primary text-primary-foreground hover:bg-primary/80",
  gradient:
    "bg-gradient-primary text-white hover:opacity-90 focus-visible:ring-[var(--color-blue)]/50",
  outline:
    "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
  ghost:
    "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
  destructive:
    "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
  link: "text-primary underline-offset-4 hover:underline",
},
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros relacionados a `button.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(ui): add gradient variant to Button component"
```

---

## Task 4: Input — Focus Ring Azul

**Files:**
- Modify: `src/components/ui/input.tsx`

- [ ] **Step 1: Ler o arquivo atual**

```bash
cat src/components/ui/input.tsx
```

- [ ] **Step 2: Garantir que o input usa `--ring` (já mapeado para blue)**

O input deve ter na sua className base:
```
focus-visible:ring-ring/30 focus-visible:border-ring
```

Se o arquivo já usa essas classes via `--ring`, apenas confirme que o token `--ring` foi atualizado para azul na Task 1 (já foi). Nenhuma mudança adicional necessária no arquivo.

Se usar cores hardcoded, atualize para usar `border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20`.

- [ ] **Step 3: Commit (se houve mudança)**

```bash
git add src/components/ui/input.tsx
git commit -m "feat(ui): input focus ring now uses brand blue token"
```

---

## Task 5: EmptyState Component

**Files:**
- Create: `src/components/ui/empty-state.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import { type LucideIcon } from 'lucide-react'
import { Button } from './button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-[var(--color-blue)]" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">{description}</p>
      {actionLabel && (onAction || actionHref) && (
        actionHref ? (
          <a href={actionHref}>
            <Button variant="gradient">{actionLabel}</Button>
          </a>
        ) : (
          <Button variant="gradient" onClick={onAction}>{actionLabel}</Button>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "empty-state"
```

Esperado: sem saída (sem erros).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/empty-state.tsx
git commit -m "feat(ui): add EmptyState component"
```

---

## Task 6: ThemeToggle Component

**Files:**
- Create: `src/components/ui/theme-toggle.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from './button'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = stored === 'dark' || (!stored && prefersDark)
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      className="text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "theme-toggle"
```

Esperado: sem saída.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/theme-toggle.tsx
git commit -m "feat(ui): add ThemeToggle component with localStorage persistence"
```

---

## Task 7: Sidebar Redesign — Dashboard Layout

**Files:**
- Modify: `src/app/(dashboard)/dashboard/layout.tsx`

- [ ] **Step 1: Substituir o conteúdo completo do arquivo**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated, clearAccessToken } from '@/lib/auth'
import { api } from '@/lib/api'
import {
  Bot,
  MessageSquare,
  LayoutDashboard,
  LogOut,
  Building2,
  Users,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const NAV = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/crews', label: 'Crews', icon: Users },
  { href: '/dashboard/agents', label: 'Agentes', icon: Bot },
  { href: '/dashboard/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/dashboard/departments', label: 'Departamentos', icon: Building2 },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
  }, [router])

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  async function handleLogout() {
    try { await api.auth.logout() } catch { /* ignore */ }
    clearAccessToken()
    router.replace('/login')
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">C</span>
        </div>
        <div>
          <span className="font-bold text-foreground text-sm tracking-tight">crewomni</span>
          <span className="font-bold text-sm" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>.ia</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative',
                active
                  ? 'text-foreground bg-[var(--color-blue)]/8'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-primary"
                />
              )}
              <Icon
                className={cn(
                  'w-4 h-4 flex-shrink-0',
                  active ? 'text-[var(--color-blue)]' : 'text-muted-foreground'
                )}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border space-y-1 flex-shrink-0">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs text-muted-foreground">Aparência</span>
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 md:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground"
          onClick={() => setDrawerOpen(false)}
        >
          <X className="w-4 h-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="flex items-center gap-3 px-4 h-14 border-b border-border bg-background md:hidden flex-shrink-0">
          <button
            className="p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="font-bold text-sm text-foreground">crewomni.ia</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "layout"
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/layout.tsx
git commit -m "feat(ui): redesign sidebar with Gradient Shell — drawer mobile, brand gradient, theme toggle"
```

---

## Task 8: Login Page — Split Layout

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Substituir o conteúdo completo**

```tsx
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
        {/* Gradient background blob */}
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
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            <div>
              <span className="font-bold text-2xl text-foreground">crewomni</span>
              <span
                className="font-bold text-2xl"
                style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
              >.ia</span>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-lg font-medium text-foreground leading-relaxed">
            Orquestre equipes de IA com inteligência.
          </p>

          {/* Feature list */}
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
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "login"
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(auth)/login/page.tsx
git commit -m "feat(ui): redesign login page with split layout"
```

---

## Task 9: Dashboard Home — Atualizar Cards

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Substituir o conteúdo — aplicar EmptyState e novos estilos**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, type AgentListItem, type ConversationItem } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bot, MessageSquare, Activity, Plus } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'

export default function DashboardHome() {
  const [agents, setAgents] = useState<AgentListItem[]>([])
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.agents.list(), api.conversations.list(undefined, 1)])
      .then(([a, c]) => { setAgents(a); setConversations(c.conversations) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const activeAgents = agents.filter(a => a.status === 'ACTIVE').length
  const openConversations = conversations.filter(c => c.status === 'OPEN').length

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Início</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral da sua plataforma</p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button variant="gradient" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Agente
          </Button>
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Agentes ativos
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-blue)]/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-[var(--color-blue)]" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{loading ? '—' : activeAgents}</p>
            <p className="text-xs text-muted-foreground mt-1">{loading ? '' : `${agents.length} total`}</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Conversas abertas
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-purple)]/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-[var(--color-purple)]" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{loading ? '—' : openConversations}</p>
            <p className="text-xs text-muted-foreground mt-1">{loading ? '' : `${conversations.length} recentes`}</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status da plataforma
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-sm font-semibold text-foreground">Operacional</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent agents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Agentes recentes</h2>
          <Link href="/dashboard/agents" className="text-xs text-[var(--color-blue)] hover:underline font-medium">
            Ver todos
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="Nenhum agente ainda"
            description="Crie seu primeiro agente de IA para começar a automatizar tarefas."
            actionLabel="+ Criar agente"
            actionHref="/dashboard/agents/new"
          />
        ) : (
          <div className="space-y-2">
            {agents.slice(0, 5).map(agent => (
              <Link key={agent.id} href={`/dashboard/agents/${agent.id}`}>
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border hover:border-[var(--color-blue)]/30 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-primary/10 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-[var(--color-blue)]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.type}</p>
                    </div>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/page"
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(ui): update dashboard home with Gradient Shell cards and EmptyState"
```

---

## Task 10: Onboarding Wizard

**Files:**
- Create: `src/components/onboarding/OnboardingWizard.tsx`
- Modify: `src/app/(dashboard)/dashboard/layout.tsx`

- [ ] **Step 1: Criar o wizard**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, X } from 'lucide-react'

interface OnboardingWizardProps {
  onComplete: () => void
}

type Step = 1 | 2 | 3

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>(1)
  const [orgName, setOrgName] = useState('')
  const [crewName, setCrewName] = useState('')
  const [crewGoal, setCrewGoal] = useState('')

  function dismiss() {
    localStorage.setItem('onboarding_complete', 'true')
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-border">
          <div
            className="h-full bg-gradient-primary transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Passo {step} de 3
            </span>
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Como sua empresa se chama?</h2>
                <p className="text-sm text-muted-foreground mt-1">Vamos personalizar sua experiência.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Nome da organização
                </Label>
                <Input
                  placeholder="Ex: Acme Corp"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  autoFocus
                />
              </div>
              <Button
                variant="gradient"
                className="w-full"
                disabled={!orgName.trim()}
                onClick={() => setStep(2)}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Crie seu primeiro Crew</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Um Crew é uma equipe de agentes com um objetivo compartilhado.
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Nome do Crew
                  </Label>
                  <Input
                    placeholder="Ex: Equipe de Suporte"
                    value={crewName}
                    onChange={e => setCrewName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Objetivo
                  </Label>
                  <Input
                    placeholder="Ex: Atender clientes com IA"
                    value={crewGoal}
                    onChange={e => setCrewGoal(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Voltar
                </Button>
                <Button
                  variant="gradient"
                  className="flex-1"
                  disabled={!crewName.trim()}
                  onClick={() => setStep(3)}
                >
                  Criar Crew
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-[var(--color-blue)]" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Tudo pronto!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Seu Crew <strong>{crewName}</strong> foi criado. Agora adicione agentes e comece a automatizar.
                </p>
              </div>
              <Button variant="gradient" className="w-full" onClick={dismiss}>
                Abrir meu Crew →
              </Button>
            </div>
          )}

          {/* Skip link */}
          {step < 3 && (
            <button
              onClick={dismiss}
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Pular por agora
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar OnboardingWizard ao DashboardLayout**

Em `src/app/(dashboard)/dashboard/layout.tsx`, adicione após os imports:

```tsx
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
```

Adicione state no componente:

```tsx
const [showOnboarding, setShowOnboarding] = useState(false)

useEffect(() => {
  const done = localStorage.getItem('onboarding_complete')
  if (!done) setShowOnboarding(true)
}, [])
```

Adicione antes do `return` final (dentro do JSX do return, como primeiro filho do fragment ou do wrapper):

```tsx
{showOnboarding && (
  <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
)}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "onboarding|layout"
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/OnboardingWizard.tsx src/app/(dashboard)/dashboard/layout.tsx
git commit -m "feat(ui): add OnboardingWizard with 3-step firstLogin flow"
```

---

## Task 11: Build Final e Verificação

- [ ] **Step 1: Executar build completo**

```bash
npm run build 2>&1 | tail -30
```

Esperado: `✓ Compiled successfully` ou equivalente sem erros de build.

- [ ] **Step 2: Executar TypeScript check completo**

```bash
npx tsc --noEmit 2>&1
```

Esperado: sem erros. Avisos são OK.

- [ ] **Step 3: Rodar testes existentes**

```bash
npm test 2>&1 | tail -20
```

Esperado: os 231 testes existentes ainda passam (o redesign não toca lógica de domínio).

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore(ui): final build verification — Gradient Shell redesign complete"
```

---

## Checklist Spec vs Plan

| Requisito do Spec | Task |
|---|---|
| Paleta ciano/azul/roxo + tokens CSS | Task 1 |
| Inter como fonte principal | Task 2 |
| Remover dark mode forçado | Task 2 |
| Botão com variante gradient | Task 3 |
| Input focus ring azul | Task 4 |
| EmptyState component | Task 5 |
| ThemeToggle com localStorage | Task 6 |
| Sidebar redesenhada + drawer mobile | Task 7 |
| Login split layout | Task 8 |
| Dashboard home atualizado | Task 9 |
| Onboarding wizard 3 passos | Task 10 |
| Dark mode tokens | Task 1 (bloco `.dark`) |
| Build limpo | Task 11 |
