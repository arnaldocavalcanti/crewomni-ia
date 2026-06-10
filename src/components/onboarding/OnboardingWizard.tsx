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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
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
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors">
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
