'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, type ConversationItem } from '@/lib/api'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MessageSquare } from 'lucide-react'

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.conversations.list().then(data => {
      setConversations(data.conversations)
      setTotal(data.total)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Conversas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? 'Carregando…' : `${total} conversa${total !== 1 ? 's' : ''} no total`}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 border border-dashed border-border rounded-xl">
          <MessageSquare className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
          <p className="text-xs text-muted-foreground">As conversas aparecerão aqui quando os visitantes interagirem com seus agentes</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Conversa</TableHead>
                <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                <TableHead className="text-muted-foreground font-medium">Mensagens</TableHead>
                <TableHead className="text-muted-foreground font-medium">Última atividade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map(conv => (
                <TableRow key={conv.id} className="border-border hover:bg-secondary/50 cursor-pointer">
                  <TableCell>
                    <Link href={`/dashboard/conversations/${conv.id}`} className="block group">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {conv.id.slice(0, 8)}…
                      </p>
                      {conv.externalUserId && (
                        <p className="text-xs text-muted-foreground">{conv.externalUserId}</p>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell><StatusBadge status={conv.status} /></TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{conv.messageCount}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(conv.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
