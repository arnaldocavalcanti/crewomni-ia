import { AppError } from '@/shared/errors/AppError'
import { canAgentProcess } from '@/domains/conversation-lifecycle/entities/ConversationLifecycleEvent'
import type { IInboundEventRepository } from '@/domains/channel/repositories/IInboundEventRepository'
import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import type { IMemoryPolicyEngine } from '@/domains/memory-policy/IMemoryPolicyEngine'
import type { IUsageLimiter } from '@/domains/usage-limits/IUsageLimiter'
import type { RecordExecutionTrace } from '@/domains/observability/use-cases/RecordExecutionTrace'
import type { SendMessage } from '@/domains/conversation/use-cases/SendMessage'
import type { ResolveOrCreateContact } from '@/domains/contact/use-cases/ResolveOrCreateContact'
import type { IWorkflowExecutor } from '@/domains/crew-workflow/interfaces/IWorkflowExecutor'
import type { ICrewWorkflowRepository } from '@/domains/crew-workflow/repositories/ICrewWorkflowRepository'

import type { ChannelDispatcherFactory } from '@/infrastructure/channel/ChannelDispatcherFactory'

export class OrchestrateInboundMessage {
  constructor(
    private inboundRepo: IInboundEventRepository,
    private conversationRepo: IConversationRepository,
    private resolveContact: ResolveOrCreateContact,
    private memoryPolicy: IMemoryPolicyEngine,
    private usageLimiter: IUsageLimiter,
    private traceRecorder: RecordExecutionTrace,
    private sendMessage: SendMessage,
    private dispatcherFactory?: ChannelDispatcherFactory,
    private workflowExecutor?: IWorkflowExecutor,
    private workflowRepo?: ICrewWorkflowRepository,
  ) {}

  async execute(inboundEventId: string, tenantId: string): Promise<void> {
    const event = await this.inboundRepo.findById(inboundEventId, tenantId)
    if (!event) throw new AppError('INBOUND_EVENT_NOT_FOUND', 'Evento não encontrado')

    await this.inboundRepo.updateStatus(inboundEventId, 'PROCESSING')

    const trace = await this.traceRecorder.start({
      tenantId,
      conversationId: event.providerConversationId ?? 'new',
      inboundEventId,
      agentId: '', // resolvido abaixo
      channel: event.channel,
    })

    const startTime = Date.now()

    try {
      // 1. Verificar quota
      const usageCheck = await this.usageLimiter.check(tenantId)
      if (!usageCheck.allowed) {
        await this.inboundRepo.updateStatus(inboundEventId, 'FAILED', { error: usageCheck.reason })
        return
      }

      // 2. Resolver contato
      const { contact } = await this.resolveContact.execute({
        tenantId,
        channel: event.channel,
        provider: event.provider,
        externalId: event.contactExternalId,
      })

      // 3. Verificar lifecycle da conversa (se existir conversa ativa)
      const existingConv = event.providerConversationId
        ? await this.conversationRepo.findConversationById({ id: event.providerConversationId, tenantId })
        : null

      if (existingConv && !canAgentProcess(existingConv.status as any)) {
        // Armazena mensagem mas não chama agente
        await this.inboundRepo.updateStatus(inboundEventId, 'PROCESSED', { processedAt: new Date() })
        return
      }

      // 4. Aplicar política de memória
      const memoryContext = await this.memoryPolicy.apply({
        tenantId,
        conversationId: existingConv?.id ?? 'new',
        contactId: contact.id,
      })

      const text = event.normalizedPayload?.text ?? ''
      const agentId = (event.rawPayload['agentId'] as string) ?? existingConv?.agentId ?? 'agent-default'
      const crewId = (event.rawPayload['crewId'] as string) ?? existingConv?.crewId

      let result: any
      let workflowDef = null

      if (crewId && this.workflowRepo) {
        workflowDef = await this.workflowRepo.findByCrewId({ crewId, tenantId })
      }

      if (workflowDef && this.workflowExecutor) {
        // Roteamento para Workflow (LangGraph)
        const wfResult = await this.workflowExecutor.execute({
          workflow: workflowDef,
          conversationId: existingConv?.id ?? 'new',
          tenantId,
          inputMessage: text,
          currentState: (existingConv as any)?.workflowState,
        })
        
        result = {
          reply: wfResult.response,
          conversationId: existingConv?.id ?? 'new',
          tokensUsed: 50, // mock
          model: 'langgraph',
        }
        
        // Atualizaríamos o estado na conversation se houvesse conversation salva,
        // mas no fluxo atual a conversation pode ser 'new'.
        // await this.conversationRepo.updateWorkflowState(result.conversationId, wfResult.newState)
      } else {
        // Roteamento Agente Único
        result = await this.sendMessage.execute({
          tenantId,
          agentId,
          message: text,
          conversationId: existingConv?.id,
          externalUserId: contact.id,
        })
      }

      // 6. Registrar trace
      await this.traceRecorder.complete(trace.id, tenantId, {
        model: result.model ?? 'gpt-4o-mini',
        inputTokens: Math.floor((result.tokensUsed ?? 0) * 0.8),
        outputTokens: Math.floor((result.tokensUsed ?? 0) * 0.2),
        durationMs: Date.now() - startTime,
        chunksUsed: [],
        memoryBlocksUsed: memoryContext.summary ? ['summary', 'buffer'] : ['buffer'],
      })

      // 7. Registrar uso
      await this.usageLimiter.record(tenantId, result.tokensUsed ?? 0, 0)

      // 8. Despachar resposta para o canal (WhatsApp, Email, etc.)
      if (result.reply && this.dispatcherFactory && this.dispatcherFactory.has(event.provider)) {
        try {
          const dispatcher = this.dispatcherFactory.get(event.provider)
          const dispatchResult = await dispatcher.send({
            tenantId,
            conversationId: result.conversationId,
            to: event.contactExternalId,
            text: result.reply,
            metadata: event.rawPayload,
          })

          if (!dispatchResult.success) {
            console.error(`[OrchestrateInboundMessage] Dispatch failed for ${event.provider}:`, dispatchResult.error)
          }
        } catch (dispatchErr) {
          console.error(`[OrchestrateInboundMessage] Dispatch threw error for ${event.provider}`, dispatchErr)
        }
      }

      await this.inboundRepo.updateStatus(inboundEventId, 'PROCESSED', { processedAt: new Date() })
    } catch (err) {
      const error = err instanceof Error ? err.message : 'UNKNOWN_ERROR'
      await this.traceRecorder.complete(trace.id, tenantId, {
        model: '', inputTokens: 0, outputTokens: 0,
        durationMs: Date.now() - startTime,
        chunksUsed: [], memoryBlocksUsed: [], error,
      })
      const attemptCount = (event.attemptCount ?? 0) + 1
      const newStatus = attemptCount >= 3 ? 'DEAD_LETTER' : 'FAILED'
      await this.inboundRepo.updateStatus(inboundEventId, newStatus, { error, attemptCount })
      if (newStatus !== 'DEAD_LETTER') throw err  // rethrow para retry na fila
    }
  }
}
