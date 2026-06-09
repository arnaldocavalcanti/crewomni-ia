import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:            'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
  DRAFT:             'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700',
  ARCHIVED:          'bg-red-100 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
  OPEN:              'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
  CLOSED:            'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700',
  READY:             'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
  FAILED:            'bg-red-100 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
  PENDING:           'bg-amber-100 text-amber-700 border-amber-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800',
  HANDOFF_REQUESTED: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800',
  HANDOFF_ACCEPTED:  'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800',
  WAITING_USER:      'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-800',
  WAITING_AGENT:     'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-800',
  REOPENED:          'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo', DRAFT: 'Rascunho', ARCHIVED: 'Arquivado',
  OPEN: 'Aberta', CLOSED: 'Encerrada',
  READY: 'Pronto', FAILED: 'Falhou', PENDING: 'Pendente',
  HANDOFF_REQUESTED: 'Handoff Solicitado',
  HANDOFF_ACCEPTED: 'Handoff Aceito',
  WAITING_USER: 'Aguardando Usuário',
  WAITING_AGENT: 'Aguardando Agente',
  REOPENED: 'Reaberta',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
      STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700'
    )}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
