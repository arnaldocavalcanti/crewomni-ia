export type LLMMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type LLMCompleteParams = {
  systemPrompt: string
  messages: LLMMessage[]
  model?: string
  maxTokens?: number
  tools?: any[]
}

export type LLMCompleteResult = {
  content: string
  model: string
  tokensUsed: number
  toolCalls?: any[]
}

export interface ILLMProvider {
  complete(params: LLMCompleteParams): Promise<LLMCompleteResult>
}
