'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, Mail, MessageCircle, AlertCircle, SendHorizontal, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

type ChannelProvider = 'WHATSAPP' | 'EMAIL'

type Channel = {
  id: string
  provider: ChannelProvider
  phoneNumberId?: string | null
  fromAddress?: string | null
  hasCredentials?: boolean
}

export function ChannelsClient({ initialChannels }: { initialChannels: Channel[] }) {
  const [channels, setChannels] = useState<Channel[]>(initialChannels)
  const [isAdding, setIsAdding] = useState<ChannelProvider | null>(null)

  useEffect(() => {
    setChannels(initialChannels)
  }, [initialChannels])

  const refreshChannels = useCallback(async () => {
    try {
      const data = await api.channels.list()
      setChannels(data)
    } catch {
      // keep current state if refresh fails
    }
  }, [])

  // WhatsApp Form
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')

  // Email Form
  const [fromAddress, setFromAddress] = useState('')
  const [fromName, setFromName] = useState('')
  const [sendgridApiKey, setSendgridApiKey] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Test email modal
  const [testChannel, setTestChannel] = useState<Channel | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este canal?')) return
    setLoading(true)
    try {
      await api.channels.delete(id)
      await refreshChannels()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testChannel) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const data = await api.channels.test(testChannel.id, testEmail)
      setTestResult({ success: true, message: data.message || `Email enviado para ${testEmail}` })
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Falha ao enviar email de teste' })
    } finally {
      setTestLoading(false)
    }
  }

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.channels.create({
        provider: 'WHATSAPP',
        phoneNumberId,
        accessToken,
        webhookSecret
      })
      await refreshChannels()
      setIsAdding(null)
      setPhoneNumberId(''); setAccessToken(''); setWebhookSecret('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.channels.create({
        provider: 'EMAIL',
        fromAddress,
        fromName,
        sendgridApiKey
      })
      await refreshChannels()
      setIsAdding(null)
      setFromAddress(''); setFromName(''); setSendgridApiKey('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const renderChannelCard = (channel: Channel) => {
    const isWhatsapp = channel.provider === 'WHATSAPP'
    return (
      <div key={channel.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isWhatsapp ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
            {isWhatsapp ? <MessageCircle className="h-6 w-6" /> : <Mail className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground">{isWhatsapp ? 'WhatsApp' : 'E-mail'}</h3>
            <p className="text-sm text-muted-foreground">
              {isWhatsapp ? `Phone Number ID: ${channel.phoneNumberId}` : `Remetente: ${channel.fromAddress}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
            Conectado
          </span>
          {!isWhatsapp && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => { setTestChannel(channel); setTestEmail(''); setTestResult(null) }}
              disabled={loading}
            >
              <SendHorizontal className="h-3.5 w-3.5" />
              Testar
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => handleDelete(channel.id)} disabled={loading}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">

      {/* Test Email Modal */}
      {testChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Testar canal E-mail</h3>
              <button
                onClick={() => { setTestChannel(null); setTestResult(null) }}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Um email de teste será enviado do endereço <strong>{testChannel.fromAddress}</strong> para o destinatário abaixo.
            </p>
            {testResult && (
              <div className={`mb-4 flex items-start gap-2 rounded-md p-3 text-sm ${
                testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${testResult.success ? 'text-green-600' : 'text-red-600'}`} />
                {testResult.message}
              </div>
            )}
            <form onSubmit={handleTest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">Email de destino</label>
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => { setTestChannel(null); setTestResult(null) }}>Cancelar</Button>
                <Button type="submit" variant="gradient" disabled={testLoading}>
                  {testLoading ? 'Enviando...' : 'Enviar teste'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      
      {channels.length > 0 && (
        <div className="space-y-4">
          {channels.map(renderChannelCard)}
        </div>
      )}

      {channels.length === 0 && !isAdding && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12">
          <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium">Nenhum canal conectado</h3>
          <p className="mb-6 text-sm text-muted-foreground">Adicione um canal para iniciar o atendimento.</p>
        </div>
      )}

      {!isAdding && (
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setIsAdding('WHATSAPP')} className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Adicionar WhatsApp
          </Button>
          <Button variant="outline" onClick={() => setIsAdding('EMAIL')} className="gap-2">
            <Mail className="h-4 w-4" />
            Adicionar E-mail
          </Button>
        </div>
      )}

      {isAdding === 'WHATSAPP' && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-medium text-foreground">Configurar WhatsApp (Meta Cloud API)</h3>
          {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>}
          <form onSubmit={handleSaveWhatsApp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Phone Number ID</label>
              <input 
                type="text" 
                required 
                className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">System User Access Token</label>
              <input 
                type="password" 
                required 
                className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                value={accessToken} onChange={e => setAccessToken(e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Webhook Verify Secret</label>
              <input 
                type="password" 
                required 
                className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} 
              />
            </div>
            <div className="mt-4 rounded-md bg-blue-50 p-4 text-sm text-blue-700">
              Configure sua URL de Webhook no painel da Meta para:<br />
              <strong>{typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp` : '/api/webhooks/whatsapp'}</strong>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAdding(null)}>Cancelar</Button>
              <Button type="submit" variant="gradient" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar WhatsApp'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {isAdding === 'EMAIL' && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-medium text-foreground">Configurar E-mail (SendGrid)</h3>
          {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>}
          <form onSubmit={handleSaveEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Endereço de E-mail (Remetente)</label>
              <input 
                type="email" 
                required 
                className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                value={fromAddress} onChange={e => setFromAddress(e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Nome de Exibição (Opcional)</label>
              <input 
                type="text" 
                className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                value={fromName} onChange={e => setFromName(e.target.value)} 
                placeholder="Ex: Suporte CrewOmni"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">SendGrid API Key</label>
              <input 
                type="password" 
                required 
                className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                value={sendgridApiKey} onChange={e => setSendgridApiKey(e.target.value)} 
              />
            </div>
            <div className="mt-4 rounded-md bg-blue-50 p-4 text-sm text-blue-700">
              Configure sua Inbound Parse URL no SendGrid para:<br />
              <strong>{typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/email` : '/api/webhooks/email'}</strong>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAdding(null)}>Cancelar</Button>
              <Button type="submit" variant="gradient" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar E-mail'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
