'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { TestSessionTrace } from '@/domains/crew/entities/TestSessionResult'

type Props = {
  trace: TestSessionTrace | null
  isAdmin: boolean
}

export function AgentTraceAccordion({ trace, isAdmin }: Props) {
  const [open, setOpen] = useState(false)

  if (!trace) return null

  return (
    <div className="border-t border-border bg-background">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
      >
        <span className="font-semibold text-foreground flex items-center gap-2">
          🔍 Trace Detalhado {isAdmin && <span className="text-xs font-normal text-muted-foreground">(Admin)</span>}
        </span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{trace.durationMs}ms total</span>
          <span>{trace.inputTokens + trace.outputTokens} tokens</span>
          <span>${trace.estimatedCostUsd.toFixed(6)}</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-muted/50 rounded-md p-3">
              <div className="text-muted-foreground mb-1">Modelo</div>
              <div className="font-mono font-semibold">{trace.model}</div>
            </div>
            <div className="bg-muted/50 rounded-md p-3">
              <div className="text-muted-foreground mb-1">Tokens (entrada / saída)</div>
              <div className="font-mono font-semibold">{trace.inputTokens} / {trace.outputTokens}</div>
            </div>
            <div className="bg-muted/50 rounded-md p-3">
              <div className="text-muted-foreground mb-1">Custo estimado</div>
              <div className="font-mono font-semibold">${trace.estimatedCostUsd.toFixed(6)}</div>
            </div>
            <div className="bg-muted/50 rounded-md p-3">
              <div className="text-muted-foreground mb-1">Duração total</div>
              <div className="font-mono font-semibold">{trace.durationMs}ms</div>
            </div>
          </div>

          {isAdmin && trace.steps && trace.steps.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Pipeline steps</div>
              <div className="space-y-1">
                {trace.steps.map((step, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded px-3 py-2">
                    <span className="font-mono text-foreground">{step.step}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {step.detail && <span className="italic">{step.detail}</span>}
                      <span className="font-semibold">{step.durationMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {trace.memoryBlocksUsed.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Memória usada: {trace.memoryBlocksUsed.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
