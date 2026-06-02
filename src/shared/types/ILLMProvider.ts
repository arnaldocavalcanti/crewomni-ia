export type LLMMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type LLMCompleteParams = {
  systemPrompt: string
  messages: LLMMessage[]
  model?: string
  maxTokens?: number
}

export type LLMCompleteResult = {
  content: string
  model: string
  tokensUsed: number
}

export interface ILLMProvider {
  complete(params: LLMCompleteParams): Promise<LLMCompleteResult>
}
