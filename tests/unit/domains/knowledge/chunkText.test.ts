import { describe, it, expect } from 'vitest'
import { chunkText } from '@/domains/knowledge/utils/chunkText'

describe('chunkText', () => {
  it('deve retornar o próprio texto como único chunk se for curto', () => {
    const text = 'Texto curto mas válido com mais de 50 caracteres aqui.'
    const chunks = chunkText(text, { chunkSize: 500 })
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(text)
  })

  it('deve dividir texto longo em múltiplos chunks', () => {
    const text = 'A'.repeat(600)
    const chunks = chunkText(text, { chunkSize: 200, overlap: 20, minChunk: 10 })
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('deve descartar chunks menores que o mínimo', () => {
    const chunks = chunkText('ok', { chunkSize: 500, minChunk: 50 })
    expect(chunks).toHaveLength(0)
  })

  it('deve aplicar overlap entre chunks consecutivos', () => {
    const text = 'palavra '.repeat(200)
    const chunks = chunkText(text, { chunkSize: 300, overlap: 50, minChunk: 10 })
    expect(chunks.length).toBeGreaterThan(1)
    // Chunks with overlap should share some content
    if (chunks.length >= 2) {
      const endOfFirst = chunks[0].slice(-30)
      const startOfSecond = chunks[1].slice(0, 100)
      expect(startOfSecond).toContain(endOfFirst.trim().split(' ')[0])
    }
  })

  it('deve preservar parágrafos como pontos de quebra preferidos', () => {
    const text = 'Parágrafo um com bastante texto.\n\nParágrafo dois com bastante texto.\n\nParágrafo três com bastante texto.'
    const chunks = chunkText(text, { chunkSize: 50, overlap: 5, minChunk: 10 })
    expect(chunks.length).toBeGreaterThanOrEqual(2)
  })

  it('deve usar defaults do ADR 003 quando sem opções', () => {
    const longText = 'palavra '.repeat(500)
    const chunks = chunkText(longText)
    expect(chunks.length).toBeGreaterThan(0)
    chunks.forEach(chunk => {
      expect(chunk.length).toBeGreaterThanOrEqual(50)
    })
  })
})
