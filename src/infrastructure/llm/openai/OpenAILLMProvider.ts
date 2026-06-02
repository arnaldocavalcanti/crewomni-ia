import OpenAI from 'openai'
import type { ILLMProvider, LLMCompleteParams, LLMCompleteResult } from '@/shared/types/ILLMProvider'

const DEFAULT_MODEL = 'gpt-4o-mini'

export class OpenAILLMProvider implements ILLMProvider {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async complete(params: LLMCompleteParams): Promise<LLMCompleteResult> {
    const response = await this.client.chat.completions.create({
      model: params.model ?? DEFAULT_MODEL,
      max_tokens: params.maxTokens,
      messages: [
        { role: 'system', content: params.systemPrompt },
        ...params.messages,
      ],
    })

    const choice = response.choices[0]

    return {
      content: choice.message.content ?? '',
      model: response.model,
      tokensUsed: response.usage?.total_tokens ?? 0,
    }
  }
}
