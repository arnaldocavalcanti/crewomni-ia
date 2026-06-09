export type DispatchParams = {
  tenantId: string
  conversationId?: string
  to: string              // número E.164 ou endereço de e-mail
  text: string
  metadata?: Record<string, unknown>
}

export type DispatchResult = {
  success: boolean
  providerId?: string     // ID da mensagem no provider (WhatsApp message_id, etc.)
  error?: string
}

export interface IChannelDispatcher {
  send(params: DispatchParams): Promise<DispatchResult>
}
