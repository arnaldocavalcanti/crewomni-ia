'use client'

import { useState, useCallback, useEffect } from 'react'
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
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flowPath, setFlowPath] = useState<FlowPathEntry[]>([])
  const [handoffs, setHandoffs] = useState<HandoffEntry[]>([])
  const [trace, setTrace] = useState<TestSessionTrace | null>(null)
  const [viewMode, setViewMode] = useState<'flow' | 'trace'>('flow')

  const [handoffState, setHandoffState] = useState<'IDLE' | 'SUGGESTED' | 'ASK_PHONE' | 'COMPLETED_WA' | 'COMPLETED_LINK'>('IDLE')
  const [handoffCrewName, setHandoffCrewName] = useState<string>('')
  const [handoffLinkUrl, setHandoffLinkUrl] = useState<string>('')
  const [phoneInput, setPhoneInput] = useState<string>('')
  const [handoffReason, setHandoffReason] = useState<string>('')

  // Reset session and messages on mode switch
  useEffect(() => {
    setConversationId(undefined)
    setMessages([])
    setHandoffState('IDLE')
    setHandoffCrewName('')
    setHandoffLinkUrl('')
    setPhoneInput('')
    setHandoffReason('')
  }, [mode])

  const noMembers = members.length === 0
  const noDirector = members.length > 0 && !members.some((m) => m.role === 'DIRECTOR')

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
        conversationId,
      })

      if (!conversationId && result.conversationId) {
        setConversationId(result.conversationId)
      }

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

      if (result.humanHandoffSuggestion) {
        setHandoffCrewName(result.humanHandoffSuggestion.crewName)
        setHandoffReason(result.humanHandoffSuggestion.reason)
        setHandoffState('SUGGESTED')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao processar mensagem'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, crewId, mode, toPhone, conversationId])

  const handleAcceptHandoff = useCallback(async (phone?: string) => {
    const activeConvId = conversationId
    if (!activeConvId) return
    setIsLoading(true)
    setError(null)
    try {
      let resolvedPhone = phone || (mode === 'WHATSAPP_REAL' ? toPhone : undefined)
      
      if (!resolvedPhone && handoffState !== 'ASK_PHONE') {
        setHandoffState('ASK_PHONE')
        setIsLoading(false)
        return
      }

      const res = await api.conversations.acceptHumanHandoff(activeConvId, resolvedPhone)
      if (res.channel === 'whatsapp') {
        setHandoffState('COMPLETED_WA')
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'agent',
            text: `[Sistema] Atendimento transferido com sucesso para WhatsApp de ${handoffCrewName || 'atendente'}.`,
          },
        ])
      } else {
        setHandoffLinkUrl(res.linkUrl || '')
        setHandoffState('COMPLETED_LINK')
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'agent',
            text: `[Sistema] Use o link do WhatsApp para falar diretamente com o atendente.`,
          },
        ])
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Erro ao aceitar handoff')
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, handoffState, handoffCrewName, mode, toPhone])

  const handleRejectHandoff = useCallback(async () => {
    const activeConvId = conversationId
    if (!activeConvId) return
    setIsLoading(true)
    setError(null)
    try {
      await api.conversations.rejectHumanHandoff(activeConvId)
      setHandoffState('IDLE')
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          text: `[Sistema] Transferência recusada. Conversa continuará com o agente de inteligência artificial.`,
        },
      ])
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Erro ao rejeitar handoff')
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  const handleSkipPhone = useCallback(async () => {
    const activeConvId = conversationId
    if (!activeConvId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.conversations.acceptHumanHandoff(activeConvId)
      setHandoffLinkUrl(res.linkUrl || '')
      setHandoffState('COMPLETED_LINK')
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          text: `[Sistema] Use o link do WhatsApp para falar diretamente com o atendente.`,
        },
      ])
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Erro ao obter link de fallback')
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

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
      {noDirector && (
        <div className="px-4 py-2 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-b border-amber-200 dark:border-amber-800">
          ⚠️ Nenhum agente está definido como <strong>Diretor</strong>. O primeiro membro adicionado será usado como ponto de entrada. Edite um agente e defina seu papel na crew como <strong>🎯 Diretor</strong>.
        </div>
      )}
      <div className="px-4 py-2 text-xs bg-muted/40 text-muted-foreground border-b border-border flex items-center gap-2">
        <span>💡 <strong>Dica de Handoff:</strong> Para a transferência automática funcionar, certifique-se de que os agentes tenham <strong>descrições claras</strong> sobre suas especialidades (ex: "Especialista em enviar propostas por e-mail"). O Diretor decide a transferência com base nessas descrições.</span>
      </div>

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
            handoffState={handoffState}
            handoffCrewName={handoffCrewName}
            handoffLinkUrl={handoffLinkUrl || undefined}
            phoneInput={phoneInput}
            setPhoneInput={setPhoneInput}
            onAcceptHandoff={handleAcceptHandoff}
            onRejectHandoff={handleRejectHandoff}
            onSkipPhone={handleSkipPhone}
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
