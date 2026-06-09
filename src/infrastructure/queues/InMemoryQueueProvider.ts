import type { IQueueProvider } from './IQueueProvider'

export class InMemoryQueueProvider implements IQueueProvider {
  private queues: Map<string, Array<Record<string, unknown>>> = new Map()
  private handlers: Map<string, (payload: Record<string, unknown>) => Promise<void>> = new Map()

  async enqueue(queueName: string, payload: Record<string, unknown>): Promise<string> {
    const jobId = crypto.randomUUID()
    
    const handler = this.handlers.get(queueName)
    if (handler) {
      // Processa em background (fire-and-forget simulando fila)
      void handler(payload).catch(err => {
        console.error(`Error processing job in queue ${queueName}:`, err)
      })
    } else {
      const q = this.queues.get(queueName) || []
      q.push(payload)
      this.queues.set(queueName, q)
    }

    return jobId
  }

  process(queueName: string, handler: (payload: Record<string, unknown>) => Promise<void>): void {
    this.handlers.set(queueName, handler)
    
    // Processa os que estavam pendentes
    const q = this.queues.get(queueName) || []
    if (q.length > 0) {
      for (const payload of q) {
        void handler(payload).catch(err => {
          console.error(`Error processing pending job in queue ${queueName}:`, err)
        })
      }
      this.queues.set(queueName, [])
    }
  }

  async getQueueSize(queueName: string): Promise<number> {
    return this.queues.get(queueName)?.length || 0
  }
}
