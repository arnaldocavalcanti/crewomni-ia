import { EventEmitter } from 'events'

export type RealtimeEventType = 'MESSAGE_RECEIVED' | 'MESSAGE_SENT' | 'LIFECYCLE_CHANGED'

export interface RealtimePayload {
  conversationId: string
  [key: string]: any
}

class RealtimeService extends EventEmitter {
  constructor() {
    super()
    // Aumentar limite de listeners para permitir múltiplas conexões simultâneas de clientes SSE
    this.setMaxListeners(1000)
  }

  /**
   * Assina eventos para um tenant específico.
   * Retorna a função de unsubscribe.
   */
  public subscribeToTenant(tenantId: string, callback: (type: RealtimeEventType, payload: RealtimePayload) => void) {
    const eventName = `tenant:${tenantId}`
    this.on(eventName, callback)

    return () => {
      this.off(eventName, callback)
    }
  }

  /**
   * Publica um evento restrito a um tenant específico.
   */
  public publishEvent(tenantId: string, type: RealtimeEventType, payload: RealtimePayload) {
    const eventName = `tenant:${tenantId}`
    this.emit(eventName, type, payload)
  }
}

// Exportar um singleton para ser injetado/usado por toda a aplicação
export const realtimeService = new RealtimeService()
