import OpenAI from 'openai'
import type { IEmbeddingProvider } from '@/shared/types/IEmbeddingProvider'

const MODEL = 'text-embedding-3-small'

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: MODEL,
      input: text,
    })
    return response.data[0].embedding
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const response = await this.client.embeddings.create({
      model: MODEL,
      input: texts,
    })
    return response.data.map((d) => d.embedding)
  }
}
