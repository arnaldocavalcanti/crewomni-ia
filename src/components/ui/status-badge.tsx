import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:   'bg-green-950 text-green-400 border-green-800',
  DRAFT:    'bg-zinc-900 text-zinc-400 border-zinc-700',
  ARCHIVED: 'bg-red-950 text-red-400 border-red-800',
  OPEN:     'bg-blue-950 text-blue-400 border-blue-800',
  CLOSED:   'bg-zinc-900 text-zinc-400 border-zinc-700',
  READY:    'bg-green-950 text-green-400 border-green-800',
  FAILED:   'bg-red-950 text-red-400 border-red-800',
  PENDING:  'bg-yellow-950 text-yellow-400 border-yellow-800',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo', DRAFT: 'Rascunho', ARCHIVED: 'Arquivado',
  OPEN: 'Aberta', CLOSED: 'Encerrada',
  READY: 'Pronto', FAILED: 'Falhou', PENDING: 'Pendente',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
      STATUS_STYLES[status] ?? 'bg-zinc-900 text-zinc-400 border-zinc-700'
    )}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
