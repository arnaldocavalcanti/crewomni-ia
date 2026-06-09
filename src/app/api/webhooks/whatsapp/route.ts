import { NextResponse } from 'next/server'
import { di } from '@/infrastructure/di'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    // Retornar o challenge exatamente como recebido (plain text)
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    // O webhookAdapter processa e ignora erros internos para não quebrar o webhook na Meta
    await di.whatsappWebhookAdapter.process(rawBody, signature)

    // Meta exige 200 OK
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[WhatsApp Webhook Error]', error)
    // Retornamos 200 de qualquer forma para evitar retry infinito / bloqueio do webhook na Meta,
    // mas em um cenário mais estrito, 500 seria enviado se o erro fosse crítico e devesse ter retry.
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
