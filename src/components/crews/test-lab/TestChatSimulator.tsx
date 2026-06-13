'use client'

import { useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type ChatMessage = {
  id: string
  role: 'user' | 'agent'
  text: string
  agentName?: string
  agentRole?: string
  isHandoff?: boolean
  handoffTo?: string
}

type Props = {
  messages: ChatMessage[]
  mode: 'SIMULATE' | 'WHATSAPP_REAL'
  toPhone: string
  input: string
  isLoading: boolean
  error: string | null
  onModeChange: (mode: 'SIMULATE' | 'WHATSAPP_REAL') => void
  onPhoneChange: (phone: string) => void
  onInputChange: (text: string) => void
  onSend: () => void

  handoffState: 'IDLE' | 'SUGGESTED' | 'ASK_PHONE' | 'COMPLETED_WA' | 'COMPLETED_LINK'
  handoffCrewName?: string
  handoffLinkUrl?: string
  phoneInput: string
  setPhoneInput: (phone: string) => void
  onAcceptHandoff: (phone?: string) => void
  onRejectHandoff: () => void
  onSkipPhone: () => void
}

export function TestChatSimulator({
  messages, mode, toPhone, input, isLoading, error,
  onModeChange, onPhoneChange, onInputChange, onSend,
  handoffState, handoffCrewName, handoffLinkUrl,
  phoneInput, setPhoneInput, onAcceptHandoff, onRejectHandoff, onSkipPhone,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="p-3 border-b border-border bg-muted/30">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Modo de teste</div>
        <div className="flex gap-2">
          <button
            onClick={() => onModeChange('SIMULATE')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              mode === 'SIMULATE'
                ? 'bg-[#4F6EF7] text-white'
                : 'bg-background border border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            ⚡ Simular
          </button>
          <button
            onClick={() => onModeChange('WHATSAPP_REAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              mode === 'WHATSAPP_REAL'
                ? 'bg-[#25D366] text-white'
                : 'bg-background border border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            📱 WhatsApp Real
          </button>
        </div>
        {mode === 'WHATSAPP_REAL' && (
          <div className="mt-2">
            <Input
              placeholder="Seu número: +5511999999999"
              value={toPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className="text-xs h-8"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use o número provisório da Meta (+1 555 555 5555) para testes
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f0f2f5] dark:bg-muted/20">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground pt-8">
            <div className="text-2xl mb-2">🧪</div>
            <p>Digite uma mensagem para iniciar o teste</p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.isHandoff) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-xs font-semibold text-[#7C3AED] bg-purple-50 dark:bg-purple-950/30 px-3 py-1 rounded-full">
                  ⇄ Transferido para {msg.handoffTo}
                </span>
              </div>
            )
          }

          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="bg-[#dcf8c6] dark:bg-green-900/50 rounded-xl rounded-br-sm px-3 py-2 max-w-[75%] shadow-sm">
                  <p className="text-sm text-foreground">{msg.text}</p>
                </div>
              </div>
            )
          }

          return (
            <div key={msg.id} className="flex flex-col gap-1">
              {msg.agentName && (
                <span className="text-xs font-semibold pl-1" style={{
                  color: msg.agentRole === 'DIRECTOR' ? '#4F6EF7' : '#7C3AED'
                }}>
                  🤖 {msg.agentName}
                </span>
              )}
              <div className="bg-white dark:bg-card rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%] shadow-sm">
                <p className="text-sm text-foreground">{msg.text}</p>
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex flex-col gap-1">
            <div className="bg-white dark:bg-card rounded-xl rounded-tl-sm px-3 py-2 w-16 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded-md px-3 py-2 text-center">
            ⚠️ {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {handoffState === 'SUGGESTED' && (
        <div className="p-3 border-t border-border bg-[#f0f2f5] dark:bg-muted/20 flex flex-col gap-2 items-center">
          <div className="text-xs text-muted-foreground text-center">
            O agente sugeriu transferir o atendimento para a equipe <strong>{handoffCrewName}</strong>. Deseja transferir?
          </div>
          <div className="flex gap-2 w-full justify-center">
            <Button
              onClick={() => onAcceptHandoff()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1.5 px-4 rounded-full"
              disabled={isLoading}
            >
              👍 Sim, transferir
            </Button>
            <Button
              onClick={onRejectHandoff}
              variant="outline"
              className="text-xs py-1.5 px-4 rounded-full border-border hover:bg-muted/50"
              disabled={isLoading}
            >
              Não, continuar aqui
            </Button>
          </div>
        </div>
      )}

      {handoffState === 'ASK_PHONE' && (
        <div className="p-4 border-t border-border bg-[#f0f2f5] dark:bg-muted/20 space-y-3">
          <div className="text-xs text-foreground font-medium">
            Para continuar pelo WhatsApp, qual é o seu número?
          </div>
          <div className="flex gap-2">
            <Input
              id="handoffCustomerPhone"
              placeholder="+55 11 99999-9999"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="flex-1 text-xs bg-white dark:bg-card h-8"
              disabled={isLoading}
            />
            <Button
              onClick={() => onAcceptHandoff(phoneInput)}
              className="bg-[#4F6EF7] text-white text-xs h-8"
              disabled={isLoading || !phoneInput.trim()}
            >
              Confirmar
            </Button>
          </div>
          <div className="text-center">
            <button
              onClick={onSkipPhone}
              className="text-xs text-[#4F6EF7] hover:underline"
              disabled={isLoading}
            >
              Prefiro não informar → falar no WhatsApp direto
            </button>
          </div>
        </div>
      )}

      {handoffState === 'COMPLETED_WA' && (
        <div className="p-4 border-t border-border bg-emerald-50 dark:bg-emerald-950/20 text-center space-y-2">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
            <span>✓ Transferência realizada!</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Você receberá uma mensagem no WhatsApp em instantes. O atendimento automatizado foi encerrado.
          </p>
        </div>
      )}

      {handoffState === 'COMPLETED_LINK' && (
        <div className="p-4 border-t border-border bg-emerald-50 dark:bg-emerald-950/20 text-center space-y-3">
          <div className="text-xs text-muted-foreground mb-1">
            Tudo bem! Você pode continuar pelo WhatsApp clicando no botão abaixo:
          </div>
          {handoffLinkUrl && (
            <a
              href={handoffLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors w-full"
            >
              <span>💬 Falar no WhatsApp</span>
            </a>
          )}
        </div>
      )}

      {handoffState === 'IDLE' && (
        <div className="p-3 border-t border-border bg-[#f0f2f5] dark:bg-muted/20 flex gap-2">
          <Input
            placeholder="Digite uma mensagem de teste..."
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1 text-sm bg-white dark:bg-card"
          />
          <Button
            onClick={onSend}
            disabled={isLoading || !input.trim()}
            size="sm"
            className="bg-gradient-to-r from-[#06C8E8] via-[#4F6EF7] to-[#7C3AED] text-white hover:opacity-90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
