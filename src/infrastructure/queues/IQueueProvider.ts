export interface IQueueProvider {
  enqueue(queueName: string, payload: Record<string, unknown>): Promise<string>
  process(
    queueName: string,
    handler: (payload: Record<string, unknown>) => Promise<void>
  ): void
  getQueueSize(queueName: string): Promise<number>
}

export const QUEUE_NAMES = {
  INBOUND_MESSAGE: 'inbound-message',
  AGENT_PROCESSING: 'agent-processing',
  OUTBOUND_MESSAGE: 'outbound-message',
  FAILED_MESSAGE: 'failed-message',
} as const
