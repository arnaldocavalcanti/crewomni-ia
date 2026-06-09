import { describe, it, expect, vi } from 'vitest'
import { InMemoryQueueProvider } from '@/infrastructure/queues/InMemoryQueueProvider'

describe('InMemoryQueueProvider', () => {
  it('deve enfileirar job e retornar um id', async () => {
    const queue = new InMemoryQueueProvider()
    const jobId = await queue.enqueue('inbound-message', { foo: 'bar' })
    expect(typeof jobId).toBe('string')
    expect(jobId.length).toBeGreaterThan(0)
  })

  it('deve processar job com o handler registrado', async () => {
    const queue = new InMemoryQueueProvider()
    const handler = vi.fn().mockResolvedValue(undefined)
    queue.process('inbound-message', handler)
    await queue.enqueue('inbound-message', { test: 1 })
    // Como é assíncrono, damos um pequeno delay
    await new Promise(r => setTimeout(r, 10))
    expect(handler).toHaveBeenCalledWith({ test: 1 })
  })

  it('deve retornar tamanho da fila', async () => {
    const queue = new InMemoryQueueProvider()
    // sem handler: jobs ficam pendentes
    await queue.enqueue('pending-queue', { a: 1 })
    await queue.enqueue('pending-queue', { b: 2 })
    const size = await queue.getQueueSize('pending-queue')
    expect(size).toBe(2)
  })
})
