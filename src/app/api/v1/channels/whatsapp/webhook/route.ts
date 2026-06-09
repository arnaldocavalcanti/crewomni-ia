import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'

// GET: verificação de webhook pelo Meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// POST: recebimento de mensagens
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  // O adapter processa, valida assinatura e enfileira se for válido.
  // Falhas de validação (como JSON inválido ou assinatura incorreta) 
  // são logadas internamente, mas retornamos 200 OK para o Meta não desativar o webhook.
  di.whatsappWebhookAdapter.process(rawBody, signature)
    .catch(err => console.error('[webhook] WhatsAppWebhookAdapter error:', err))

  return Response.json({ status: 'accepted' }, { status: 200 })
}
