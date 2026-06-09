import { redirect } from 'next/navigation'
import { getServerSession } from '@/shared/guards/withSession'
import { di } from '@/infrastructure/di'
import { ChannelsClient } from './ChannelsClient'

export const metadata = {
  title: 'Canais | CrewOmni',
}

export default async function ChannelsPage() {
  const session = await getServerSession()
  if (!session || !session.tenantId) {
    redirect('/auth/login')
  }

  const channels = await di.listChannelConfigs.execute({ tenantId: session.tenantId })

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Canais de Atendimento</h1>
          <p className="text-sm text-muted-foreground">
            Integre o WhatsApp e E-mail para que seus agentes omnicanal possam responder clientes automaticamente.
          </p>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto p-6">
        <ChannelsClient initialChannels={channels} />
      </main>
    </div>
  )
}
