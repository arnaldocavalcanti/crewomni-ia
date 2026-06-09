export type Channel = 'WHATSAPP' | 'EMAIL' | 'WIDGET' | 'API'

export type InboundEventStatus =
  | 'RECEIVED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'IGNORED_DUPLICATE'

export type NormalizedMessage = {
  text: string
  mediaUrl?: string
  mediaType?: 'image' | 'audio' | 'video' | 'document'
  replyToMessageId?: string
  metadata?: Record<string, unknown>
}
