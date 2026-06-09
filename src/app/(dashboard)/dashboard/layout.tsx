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
  BarChart3,
  Share2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

function SidebarMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sm-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#060B1A" />
          <stop offset="100%" stopColor="#0C1230" />
        </linearGradient>
        <linearGradient id="sm-c" x1="8" y1="8" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06D6E3" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="sm-ring" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06D6E3" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      {/* Background */}
      <rect width="40" height="40" rx="10" fill="url(#sm-bg)" />
      {/* Outer node ring — 6 nodes */}
      {/* top */}
      <circle cx="20" cy="5"  r="2.2" fill="#06D6E3" opacity="0.9" />
      {/* top-right */}
      <circle cx="33" cy="12.5" r="1.8" fill="#3B82F6" opacity="0.85" />
      {/* bottom-right */}
      <circle cx="33" cy="27.5" r="1.8" fill="#6366F1" opacity="0.8" />
      {/* bottom */}
      <circle cx="20" cy="35" r="2.2" fill="#8B5CF6" opacity="0.9" />
      {/* bottom-left */}
      <circle cx="7"  cy="27.5" r="1.8" fill="#6366F1" opacity="0.8" />
      {/* top-left */}
      <circle cx="7"  cy="12.5" r="1.8" fill="#3B82F6" opacity="0.85" />
      {/* Connection arcs (subtle dashed) */}
      <path d="M20 5 Q33 5 33 12.5"    stroke="url(#sm-ring)" strokeWidth="0.8" strokeDasharray="2 2" fill="none" opacity="0.5" />
      <path d="M33 12.5 Q38 20 33 27.5" stroke="url(#sm-ring)" strokeWidth="0.8" strokeDasharray="2 2" fill="none" opacity="0.5" />
      <path d="M33 27.5 Q33 35 20 35"  stroke="url(#sm-ring)" strokeWidth="0.8" strokeDasharray="2 2" fill="none" opacity="0.5" />
      <path d="M20 35 Q7 35 7 27.5"    stroke="url(#sm-ring)" strokeWidth="0.8" strokeDasharray="2 2" fill="none" opacity="0.5" />
      <path d="M7 27.5 Q2 20 7 12.5"   stroke="url(#sm-ring)" strokeWidth="0.8" strokeDasharray="2 2" fill="none" opacity="0.5" />
      <path d="M7 12.5 Q7 5 20 5"      stroke="url(#sm-ring)" strokeWidth="0.8" strokeDasharray="2 2" fill="none" opacity="0.5" />
      {/* Center "C" */}
      <text x="20" y="25.5" textAnchor="middle" fontSize="17" fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif" fill="url(#sm-c)" letterSpacing="-0.5">
        C
      </text>
      {/* Accent dot */}
      <circle cx="27" cy="14" r="1" fill="#06D6E3" opacity="0.9" />
    </svg>
  )
}

const NAV = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/crews', label: 'Crews', icon: Users },
  { href: '/dashboard/agents', label: 'Agentes', icon: Bot },
  { href: '/dashboard/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/dashboard/departments', label: 'Departamentos', icon: Building2 },
  { href: '/dashboard/channels', label: 'Canais', icon: Share2 },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
  }, [router])

  useEffect(() => {
    const done = localStorage.getItem('onboarding_complete')
    if (!done) setShowOnboarding(true)
  }, [])

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
      <div className="flex items-center justify-center h-24 border-b border-sidebar-border flex-shrink-0 px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon_logo_crewomni.png"
          alt="crewomni.ia"
          style={{ width: 72, height: 72, objectFit: 'contain' }}
        />
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
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1 flex-shrink-0">
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
    <>
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_crewomni.png" alt="crewomni.ia" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
    </>
  )
}
