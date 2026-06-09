'use client'

import { useState } from 'react'
import { Plus, Trash2, Mail, MessageCircle, AlertCircle } from 'lucide-react'
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

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este canal?')) return
    setLoading(true)
    try {
      await api.channels.delete(id)
      setChannels(channels.filter(c => c.id !== id))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.channels.create({
        provider: 'WHATSAPP',
        phoneNumberId,
        accessToken,
        webhookSecret
      })
      
      setChannels([...channels, data])
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
      const data = await api.channels.create({
        provider: 'EMAIL',
        fromAddress,
        fromName,
        sendgridApiKey
      })
      
      setChannels([...channels, data])
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
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
            Conectado
          </span>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(channel.id)} disabled={loading}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      
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
