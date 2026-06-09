import { NextResponse } from 'next/server'
import { di } from '@/infrastructure/di'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    await di.emailWebhookAdapter.process(formData)

    // SendGrid also expects 200 OK
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[Email Webhook Error]', error)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
