import { describe, expect, it } from 'vitest'
import { detectOwnTransfer, normalizeCounterparty } from './counterparty'

describe('normalizeCounterparty', () => {
  it('normaliza acentos, case e espaços', () => {
    expect(normalizeCounterparty('  João   Silva  ')).toBe('joao silva')
  })

  it('remove termos irrelevantes comuns', () => {
    expect(normalizeCounterparty('PIX recebido João Silva')).toBe('joao silva')
  })

  it('remove pontuação e espaços redundantes', () => {
    expect(normalizeCounterparty('  PIX   enviado - João   Silva!!! ')).toBe('joao silva')
  })

  it('retorna undefined para valor vazio', () => {
    expect(normalizeCounterparty('   ')).toBeUndefined()
  })

  it('retorna undefined para undefined', () => {
    expect(normalizeCounterparty(undefined)).toBeUndefined()
  })

  it('retorna undefined quando sobra apenas ruído removível', () => {
    expect(normalizeCounterparty('pix recebido')).toBeUndefined()
  })

  it('XSS Guard: string com tags HTML é tratada como texto puro, sem execução', () => {
    // normalizeCounterpartyText remove <, > via [^a-z0-9\s] → texto puro sem HTML
    const result = normalizeCounterparty('<script>alert(1)</script>')
    expect(result).toBe('script alert 1 script')
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
  })

  it('retorna undefined para string composta apenas de emoji', () => {
    // emoji → removido por [^a-z0-9\s] → string vazia → undefined
    expect(normalizeCounterparty('☕🥐🎉')).toBeUndefined()
  })

  it('string muito longa não causa crash e retorna resultado normalizado', () => {
    const longName = 'João Silva '.repeat(200) // ~2200 caracteres
    const result = normalizeCounterparty(longName)
    // Deve retornar algo definido (não undefined) e não lançar exceção
    expect(result).toBeDefined()
    expect(result).toContain('joao silva')
  })
})

describe('detectOwnTransfer', () => {
  it('retorna true para descrição com sinal forte', () => {
    expect(
      detectOwnTransfer({
        description: 'Transferência entre contas',
      }),
    ).toBe(true)
  })

  it('retorna true para contraparte com sinal forte', () => {
    expect(
      detectOwnTransfer({
        counterparty: 'Conta própria',
      }),
    ).toBe(true)
  })

  it('retorna undefined quando não há sinal forte', () => {
    expect(
      detectOwnTransfer({
        description: 'Pix enviado para João',
        counterparty: 'João Silva',
      }),
    ).toBeUndefined()
  })

  it('retorna undefined quando não há texto suficiente', () => {
    expect(
      detectOwnTransfer({
        description: '',
        counterparty: undefined,
      }),
    ).toBeUndefined()
  })
})
