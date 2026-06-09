import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph'
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import type { IWorkflowExecutor, ExecuteWorkflowParams, ExecuteWorkflowResult } from '@/domains/crew-workflow/interfaces/IWorkflowExecutor'

// Define the state schema
const GraphState = {
  messages: {
    value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  },
}

export class LangGraphWorkflowExecutor implements IWorkflowExecutor {
  async execute({ workflow, conversationId, inputMessage, currentState }: ExecuteWorkflowParams): Promise<ExecuteWorkflowResult> {
    const builder = new StateGraph<any>({ channels: GraphState })

    builder.addNode('dynamic_agent', async (state: any) => {
      const messages = state.messages
      const lastMessage = messages[messages.length - 1]
      return { messages: [new AIMessage(`Agent Execution (LangGraph): ${lastMessage.content}`)] }
    })

    builder.addEdge(START, 'dynamic_agent' as any)
    builder.addEdge('dynamic_agent' as any, END)

    const checkpointer = new MemorySaver()
    const app = builder.compile({ checkpointer })

    const config = { configurable: { thread_id: conversationId } }

    const result = await app.invoke({
      messages: [new HumanMessage(inputMessage)]
    }, config)

    const finalMessages = (result as any).messages
    const lastMsg = finalMessages[finalMessages.length - 1]

    return {
      response: lastMsg.content,
      newState: { thread_id: conversationId, state: 'dynamic_agent_finished' },
      isFinished: true
    }
  }
}
