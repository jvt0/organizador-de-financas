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