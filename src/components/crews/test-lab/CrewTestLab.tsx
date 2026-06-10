'use client'

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { TestChatSimulator, type ChatMessage } from './TestChatSimulator'
import { CrewFlowDiagram } from './CrewFlowDiagram'
import { AgentTraceAccordion } from './AgentTraceAccordion'
import type { TestSessionTrace, FlowPathEntry, HandoffEntry } from '@/domains/crew/entities/TestSessionResult'

type CrewMember = {
  agentId: string
  agentName: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
}

type Props = {
  crewId: string
  crewStatus: string
  members: CrewMember[]
  isAdmin: boolean
}

export function CrewTestLab({ crewId, crewStatus, members, isAdmin }: Props) {
  const [mode, setMode] = useState<'SIMULATE' | 'WHATSAPP_REAL'>('SIMULATE')
  const [toPhone, setToPhone] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flowPath, setFlowPath] = useState<FlowPathEntry[]>([])
  const [handoffs, setHandoffs] = useState<HandoffEntry[]>([])
  const [trace, setTrace] = useState<TestSessionTrace | null>(null)
  const [viewMode, setViewMode] = useState<'flow' | 'trace'>('flow')

  const noMembers = members.length === 0

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input.trim(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setError(null)
    setIsLoading(true)

    try {
      const result = await api.crews.simulate(crewId, {
        message: userMsg.text,
        mode,
        toPhone: mode === 'WHATSAPP_REAL' ? toPhone : undefined,
      })

      setFlowPath(result.flowPath)
      setHandoffs(result.handoffs)
      setTrace(result.trace)

      const newMessages: ChatMessage[] = []
      for (const handoff of result.handoffs) {
        newMessages.push({
          id: crypto.randomUUID(),
          role: 'agent',
          text: '',
          isHandoff: true,
          handoffTo: handoff.toAgentName,
        })
      }

      const respondingAgent = result.flowPath.find((f) => f.action === 'RESPONDED')
      newMessages.push({
        id: crypto.randomUUID(),
        role: 'agent',
        text: result.reply,
        agentName: respondingAgent?.agentName,
        agentRole: respondingAgent?.role,
      })

      setMessages((prev) => [...prev, ...newMessages])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao processar mensagem'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, crewId, mode, toPhone])

  return (
    <div className="flex flex-col h-full">
      {(crewStatus === 'DRAFT' || crewStatus === 'ARCHIVED') && (
        <div className="px-4 py-2 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-b border-amber-200 dark:border-amber-800">
          ⚠️ Esta Crew não está ativa — os resultados do teste podem não refletir o comportamento em produção.
        </div>
      )}
      {noMembers && (
        <div className="px-4 py-2 text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-b border-red-200 dark:border-red-800">
          ⛔ Adicione agentes à Crew antes de testar.
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="w-[360px] flex-shrink-0 flex flex-col min-h-0">
          <TestChatSimulator
            messages={messages}
            mode={mode}
            toPhone={toPhone}
            input={input}
            isLoading={isLoading}
            error={error}
            onModeChange={setMode}
            onPhoneChange={setToPhone}
            onInputChange={setInput}
            onSend={handleSend}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-semibold text-foreground">Visualização do Fluxo</span>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('flow')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  viewMode === 'flow' ? 'bg-[#4F6EF7] text-white' : 'bg-background border border-border text-muted-foreground'
                }`}
              >
                Flow
              </button>
              <button
                onClick={() => setViewMode('trace')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  viewMode === 'trace' ? 'bg-[#4F6EF7] text-white' : 'bg-background border border-border text-muted-foreground'
                }`}
              >
                Trace
              </button>
            </div>
          </div>

          <div className={`flex-1 overflow-auto ${viewMode !== 'flow' ? 'hidden' : ''}`}>
            <CrewFlowDiagram
              members={members}
              flowPath={flowPath}
              handoffs={handoffs}
              isRunning={isLoading}
            />
          </div>

          {viewMode === 'trace' && (
            <div className="flex-1 overflow-auto p-4">
              {!trace ? (
                <p className="text-xs text-muted-foreground text-center pt-8">Envie uma mensagem para ver o trace.</p>
              ) : (
                <pre className="text-xs font-mono bg-muted/30 rounded-md p-4 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(trace, null, 2)}
                </pre>
              )}
            </div>
          )}

          <AgentTraceAccordion trace={trace} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  )
}
