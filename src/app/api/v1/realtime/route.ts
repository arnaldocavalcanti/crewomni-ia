import { type NextRequest } from 'next/server'
import { getSession } from '@/shared/guards/withSession'
import { realtimeService } from '@/infrastructure/realtime/RealtimeService'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    const tenantId = session.tenantId!

    const stream = new ReadableStream({
      start(controller) {
        // Envia um comentário inicial para garantir que a conexão fique aberta imediatamente
        controller.enqueue(new TextEncoder().encode(': connected\n\n'))

        const unsubscribe = realtimeService.subscribeToTenant(tenantId, (type, payload) => {
          try {
            const data = JSON.stringify(payload)
            // Formato Server-Sent Events (SSE): event: <tipo>\ndata: <json>\n\n
            const message = `event: ${type}\ndata: ${data}\n\n`
            controller.enqueue(new TextEncoder().encode(message))
          } catch (err) {
            console.error('[SSE] Error serializing payload:', err)
          }
        })

        // Quando o cliente desconecta, cancel() é chamado.
        request.signal.addEventListener('abort', () => {
          unsubscribe()
          try { controller.close() } catch (e) { /* ignore se já estiver fechado */ }
        })
      },
      cancel() {
        // O cancelamento via cancel() do stream se o client fechar
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    return new Response('Unauthorized', { status: 401 })
  }
}
