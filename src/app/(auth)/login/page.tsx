'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { setAccessToken } from '@/lib/auth'

// ─── SVG Logo ─────────────────────────────────────────────────────────────────

function CrewomniLogoMark({ size = 160 }: { size?: number }) {
  const s = size
  return (
    <svg width={s} height={s} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-c" x1="30" y1="30" x2="170" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06D6E3" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="grad-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#06D6E3" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="grad-mid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="grad-bot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <filter id="glow-strong">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-soft">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* ── Connection arcs (dashed) ── */}
      {/* top → top-right */}
      <path d="M 100 28 Q 140 28 163 63" stroke="url(#grad-top)" strokeWidth="1.5"
        strokeDasharray="4 3" strokeLinecap="round" fill="none" opacity="0.7">
        <animate attributeName="stroke-dashoffset" values="0;-28;0" dur="4s" repeatCount="indefinite" />
      </path>
      {/* top-right → bottom-right */}
      <path d="M 163 63 Q 178 100 163 137" stroke="url(#grad-mid)" strokeWidth="1.5"
        strokeDasharray="4 3" strokeLinecap="round" fill="none" opacity="0.7">
        <animate attributeName="stroke-dashoffset" values="0;-28;0" dur="4.5s" repeatCount="indefinite" />
      </path>
      {/* bottom-right → bottom */}
      <path d="M 163 137 Q 140 172 100 172" stroke="url(#grad-mid)" strokeWidth="1.5"
        strokeDasharray="4 3" strokeLinecap="round" fill="none" opacity="0.7">
        <animate attributeName="stroke-dashoffset" values="0;-28;0" dur="3.8s" repeatCount="indefinite" />
      </path>
      {/* bottom → bottom-left */}
      <path d="M 100 172 Q 60 172 37 137" stroke="url(#grad-bot)" strokeWidth="1.5"
        strokeDasharray="4 3" strokeLinecap="round" fill="none" opacity="0.7">
        <animate attributeName="stroke-dashoffset" values="0;-28;0" dur="4.2s" repeatCount="indefinite" />
      </path>
      {/* bottom-left → top-left */}
      <path d="M 37 137 Q 22 100 37 63" stroke="url(#grad-mid)" strokeWidth="1.5"
        strokeDasharray="4 3" strokeLinecap="round" fill="none" opacity="0.7">
        <animate attributeName="stroke-dashoffset" values="0;-28;0" dur="5s" repeatCount="indefinite" />
      </path>
      {/* top-left → top */}
      <path d="M 37 63 Q 60 28 100 28" stroke="url(#grad-top)" strokeWidth="1.5"
        strokeDasharray="4 3" strokeLinecap="round" fill="none" opacity="0.7">
        <animate attributeName="stroke-dashoffset" values="0;-28;0" dur="4.7s" repeatCount="indefinite" />
      </path>

      {/* ── Inner connection arcs ── */}
      <path d="M 100 28 Q 110 65 100 100" stroke="url(#grad-top)" strokeWidth="1"
        strokeDasharray="3 4" fill="none" opacity="0.4">
        <animate attributeName="stroke-dashoffset" values="0;20;0" dur="6s" repeatCount="indefinite" />
      </path>
      <path d="M 163 63 Q 128 75 100 100" stroke="url(#grad-mid)" strokeWidth="1"
        strokeDasharray="3 4" fill="none" opacity="0.4">
        <animate attributeName="stroke-dashoffset" values="0;20;0" dur="5.5s" repeatCount="indefinite" />
      </path>
      <path d="M 163 137 Q 128 125 100 100" stroke="url(#grad-mid)" strokeWidth="1"
        strokeDasharray="3 4" fill="none" opacity="0.4">
        <animate attributeName="stroke-dashoffset" values="0;20;0" dur="7s" repeatCount="indefinite" />
      </path>
      <path d="M 100 172 Q 90 135 100 100" stroke="url(#grad-bot)" strokeWidth="1"
        strokeDasharray="3 4" fill="none" opacity="0.4">
        <animate attributeName="stroke-dashoffset" values="0;20;0" dur="6.5s" repeatCount="indefinite" />
      </path>
      <path d="M 37 137 Q 72 125 100 100" stroke="url(#grad-mid)" strokeWidth="1"
        strokeDasharray="3 4" fill="none" opacity="0.4">
        <animate attributeName="stroke-dashoffset" values="0;20;0" dur="5.8s" repeatCount="indefinite" />
      </path>
      <path d="M 37 63 Q 72 75 100 100" stroke="url(#grad-top)" strokeWidth="1"
        strokeDasharray="3 4" fill="none" opacity="0.4">
        <animate attributeName="stroke-dashoffset" values="0;20;0" dur="4.9s" repeatCount="indefinite" />
      </path>

      {/* ── Outer nodes ── */}
      {/* Top — cyan */}
      <circle cx="100" cy="28" r="8" fill="url(#grad-top)" filter="url(#glow-strong)">
        <animate attributeName="r" values="8;9.5;8" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.75;1" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="100" cy="28" r="12" fill="#06D6E3" opacity="0.12">
        <animate attributeName="r" values="12;16;12" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.12;0.04;0.12" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* Top-right — blue */}
      <circle cx="163" cy="63" r="7" fill="url(#grad-mid)" filter="url(#glow-soft)">
        <animate attributeName="r" values="7;8.5;7" dur="3.7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.7;1" dur="3.7s" repeatCount="indefinite" />
      </circle>
      <circle cx="163" cy="63" r="11" fill="#3B82F6" opacity="0.1">
        <animate attributeName="r" values="11;15;11" dur="3.7s" repeatCount="indefinite" />
      </circle>

      {/* Bottom-right — blue/indigo */}
      <circle cx="163" cy="137" r="7" fill="url(#grad-mid)" filter="url(#glow-soft)">
        <animate attributeName="r" values="7;8.5;7" dur="4.1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.7;1" dur="4.1s" repeatCount="indefinite" />
      </circle>
      <circle cx="163" cy="137" r="11" fill="#6366F1" opacity="0.1">
        <animate attributeName="r" values="11;15;11" dur="4.1s" repeatCount="indefinite" />
      </circle>

      {/* Bottom — purple */}
      <circle cx="100" cy="172" r="9" fill="url(#grad-bot)" filter="url(#glow-strong)">
        <animate attributeName="r" values="9;11;9" dur="3.3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.75;1" dur="3.3s" repeatCount="indefinite" />
      </circle>
      <circle cx="100" cy="172" r="14" fill="#8B5CF6" opacity="0.12">
        <animate attributeName="r" values="14;18;14" dur="3.3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.12;0.04;0.12" dur="3.3s" repeatCount="indefinite" />
      </circle>

      {/* Bottom-left — blue */}
      <circle cx="37" cy="137" r="7" fill="url(#grad-mid)" filter="url(#glow-soft)">
        <animate attributeName="r" values="7;8.5;7" dur="4.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="37" cy="137" r="11" fill="#6366F1" opacity="0.1">
        <animate attributeName="r" values="11;15;11" dur="4.4s" repeatCount="indefinite" />
      </circle>

      {/* Top-left — blue */}
      <circle cx="37" cy="63" r="7" fill="url(#grad-mid)" filter="url(#glow-soft)">
        <animate attributeName="r" values="7;8.5;7" dur="3.9s" repeatCount="indefinite" />
      </circle>
      <circle cx="37" cy="63" r="11" fill="#3B82F6" opacity="0.1">
        <animate attributeName="r" values="11;15;11" dur="3.9s" repeatCount="indefinite" />
      </circle>

      {/* ── Center: "C" letter ── */}
      <text
        x="100" y="115"
        textAnchor="middle"
        fontSize="72"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="url(#grad-c)"
        filter="url(#glow-soft)"
        letterSpacing="-2"
      >
        C
      </text>

      {/* Small accent dot near C */}
      <circle cx="130" cy="72" r="4" fill="#06D6E3" opacity="0.9" filter="url(#glow-strong)">
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

// ─── Animated background particles ────────────────────────────────────────────

function BackgroundNetwork() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06D6E3" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      {/* Background floating nodes */}
      {[
        { cx: 60,  cy: 80,  r: 3,  dur: '7s'  },
        { cx: 180, cy: 120, r: 2,  dur: '9s'  },
        { cx: 300, cy: 60,  r: 4,  dur: '6s'  },
        { cx: 420, cy: 200, r: 2,  dur: '11s' },
        { cx: 80,  cy: 300, r: 3,  dur: '8s'  },
        { cx: 350, cy: 350, r: 2,  dur: '10s' },
        { cx: 200, cy: 420, r: 3,  dur: '7.5s'},
        { cx: 460, cy: 80,  r: 2,  dur: '12s' },
        { cx: 130, cy: 500, r: 4,  dur: '9.5s'},
        { cx: 480, cy: 450, r: 2,  dur: '8.5s'},
      ].map((n, i) => (
        <circle key={i} cx={n.cx} cy={n.cy} r={n.r} fill="url(#bg-grad)">
          <animateTransform attributeName="transform" type="translate"
            values={`0 0; ${(i % 3) * 8 - 8} ${(i % 5) * 6 - 10}; 0 0`}
            dur={n.dur} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;1;0.6" dur={n.dur} repeatCount="indefinite" />
        </circle>
      ))}
      {/* Background connecting lines */}
      <line x1="60" y1="80" x2="180" y2="120" stroke="url(#bg-grad)" strokeWidth="0.5" strokeDasharray="3 5" opacity="0.5">
        <animate attributeName="stroke-dashoffset" values="0;-16" dur="3s" repeatCount="indefinite" />
      </line>
      <line x1="180" y1="120" x2="300" y2="60" stroke="url(#bg-grad)" strokeWidth="0.5" strokeDasharray="3 5" opacity="0.5">
        <animate attributeName="stroke-dashoffset" values="0;-16" dur="4s" repeatCount="indefinite" />
      </line>
      <line x1="300" y1="60" x2="420" y2="200" stroke="url(#bg-grad)" strokeWidth="0.5" strokeDasharray="3 5" opacity="0.5">
        <animate attributeName="stroke-dashoffset" values="0;-16" dur="5s" repeatCount="indefinite" />
      </line>
      <line x1="80" y1="300" x2="200" y2="420" stroke="url(#bg-grad)" strokeWidth="0.5" strokeDasharray="3 5" opacity="0.5">
        <animate attributeName="stroke-dashoffset" values="0;-16" dur="6s" repeatCount="indefinite" />
      </line>
      <line x1="350" y1="350" x2="480" y2="450" stroke="url(#bg-grad)" strokeWidth="0.5" strokeDasharray="3 5" opacity="0.5">
        <animate attributeName="stroke-dashoffset" values="0;-16" dur="4.5s" repeatCount="indefinite" />
      </line>
      <line x1="180" y1="120" x2="80" y2="300" stroke="url(#bg-grad)" strokeWidth="0.5" strokeDasharray="3 5" opacity="0.3">
        <animate attributeName="stroke-dashoffset" values="0;-16" dur="7s" repeatCount="indefinite" />
      </line>
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<'email' | 'password' | null>(null)

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
    <>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-8px);  }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center;  }
        }
        .animate-fade-slide { animation: fadeSlideUp 0.6s ease forwards; }
        .delay-1 { animation-delay: 0.1s; opacity: 0; }
        .delay-2 { animation-delay: 0.2s; opacity: 0; }
        .delay-3 { animation-delay: 0.35s; opacity: 0; }
        .delay-4 { animation-delay: 0.5s; opacity: 0; }
        .delay-5 { animation-delay: 0.65s; opacity: 0; }
        .logo-float { animation: logoFloat 5s ease-in-out infinite; }
        .input-glow:focus-within {
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35), 0 0 20px rgba(6, 214, 227, 0.08);
        }
        .btn-shimmer {
          background: linear-gradient(90deg, #06D6E3, #3B82F6, #8B5CF6, #3B82F6, #06D6E3);
          background-size: 200% auto;
        }
        .btn-shimmer:not(:disabled):hover {
          animation: shimmer 1.5s linear infinite;
        }
        .glass-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(8px);
        }
      `}</style>

      <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* ── Left Panel ── */}
        <div
          className="hidden md:flex md:w-1/2 relative overflow-hidden flex-col items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #060B1A 0%, #0C1230 50%, #0A0A1E 100%)' }}
        >
          {/* Background network */}
          <BackgroundNetwork />

          {/* Ambient glow blobs */}
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(6,214,227,0.06) 0%, transparent 70%)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)' }} />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center text-center gap-8 px-12 max-w-md">

            {/* Logo mark + wordmark */}
            <div className="flex flex-col items-center gap-5 animate-fade-slide delay-1">
              <div className="logo-float">
                <CrewomniLogoMark size={148} />
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="font-bold tracking-tight"
                  style={{ fontSize: '2rem', color: '#E8EDF8', letterSpacing: '-0.02em' }}>
                  crewomni
                </span>
                <span className="font-bold"
                  style={{
                    fontSize: '2rem',
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(90deg, #06D6E3, #8B5CF6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                  .ia
                </span>
              </div>
            </div>

            {/* Tagline */}
            <p className="text-base leading-relaxed animate-fade-slide delay-2"
              style={{ color: 'rgba(200,210,235,0.7)', fontWeight: 400, letterSpacing: '0.01em' }}>
              Orquestre equipes de IA<br />
              <span style={{ color: 'rgba(200,210,235,0.45)' }}>com inteligência.</span>
            </p>

            {/* Feature pills */}
            <div className="flex flex-col gap-2.5 w-full animate-fade-slide delay-3">
              {[
                { label: 'Crews ilimitados para sua equipe', color: '#06D6E3' },
                { label: 'Agentes de IA especializados',     color: '#3B82F6' },
                { label: 'Conversas em tempo real',          color: '#8B5CF6' },
              ].map(({ label, color }) => (
                <div key={label} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                  <span className="text-sm" style={{ color: 'rgba(200,215,240,0.65)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom glow line */}
          <div className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(6,214,227,0.3), rgba(139,92,246,0.3), transparent)' }} />
        </div>

        {/* ── Right Panel: Form ── */}
        <div className="flex-1 flex items-center justify-center p-6 relative"
          style={{ background: '#F8F9FC' }}>

          {/* Subtle top-right glow */}
          <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
            style={{ background: 'radial-gradient(circle at top right, rgba(6,214,227,0.05) 0%, transparent 70%)' }} />

          <div className="w-full max-w-sm space-y-8 relative">

            {/* Mobile logo */}
            <div className="flex flex-col items-center gap-3 md:hidden animate-fade-slide delay-1">
              <CrewomniLogoMark size={80} />
              <div className="flex items-baseline gap-0.5">
                <span className="font-bold text-xl" style={{ color: '#0F172A', letterSpacing: '-0.02em' }}>crewomni</span>
                <span className="font-bold text-xl"
                  style={{
                    background: 'linear-gradient(90deg, #06D6E3, #8B5CF6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    letterSpacing: '-0.02em',
                  }}>
                  .ia
                </span>
              </div>
            </div>

            {/* Heading */}
            <div className="animate-fade-slide delay-2">
              <h1 className="font-bold"
                style={{ fontSize: '1.75rem', color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                Bem-vindo de volta
              </h1>
              <p className="text-sm mt-1.5" style={{ color: '#64748B' }}>
                Entre na sua conta para continuar
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-slide delay-3">

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email"
                  className="block text-xs font-semibold uppercase tracking-widest"
                  style={{ color: '#94A3B8' }}>
                  E-mail
                </label>
                <div className={`relative rounded-xl transition-all duration-200 input-glow ${focused === 'email' ? 'ring-2 ring-blue-400/30' : ''}`}
                  style={{ background: '#fff', border: `1.5px solid ${focused === 'email' ? 'rgba(59,130,246,0.5)' : 'rgba(203,213,225,0.8)'}` }}>
                  <input
                    id="email"
                    type="email"
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    required
                    autoFocus
                    className="w-full bg-transparent px-4 py-3 text-sm outline-none"
                    style={{ color: '#0F172A' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-widest"
                  style={{ color: '#94A3B8' }}>
                  Senha
                </label>
                <div className={`relative rounded-xl transition-all duration-200 input-glow ${focused === 'password' ? 'ring-2 ring-blue-400/30' : ''}`}
                  style={{ background: '#fff', border: `1.5px solid ${focused === 'password' ? 'rgba(59,130,246,0.5)' : 'rgba(203,213,225,0.8)'}` }}>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    required
                    className="w-full bg-transparent px-4 py-3 text-sm outline-none"
                    style={{ color: '#0F172A' }}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-shimmer relative overflow-hidden rounded-xl py-3 text-sm font-semibold text-white transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(90deg, #06D6E3, #3B82F6, #8B5CF6)',
                  boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
                  letterSpacing: '0.01em',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    Entrando…
                  </span>
                ) : 'Entrar'}
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-sm animate-fade-slide delay-4" style={{ color: '#94A3B8' }}>
              Não tem conta?{' '}
              <a href="#"
                className="font-semibold transition-colors hover:opacity-80"
                style={{
                  background: 'linear-gradient(90deg, #06D6E3, #8B5CF6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                Criar conta grátis
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
