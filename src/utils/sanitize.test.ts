import { describe, expect, it } from 'vitest'
import { sanitizeCounterparty } from './sanitize'

/**
 * Casos de validação da regex de sanitização de destinatários.
 * Garante que prefixos de tipo de transação comuns em extratos brasileiros
 * sejam removidos, deixando apenas o nome da pessoa ou estabelecimento.
 */
describe('sanitizeCounterparty — casos de uso reais de extratos', () => {
  it('"Pix enviado - João Silva" → "João Silva"', () => {
    expect(sanitizeCounterparty('Pix enviado - João Silva')).toBe('João Silva')
  })

  it('"Pix recebido - Maria Oliveira" → "Maria Oliveira"', () => {
    expect(sanitizeCounterparty('Pix recebido - Maria Oliveira')).toBe('Maria Oliveira')
  })

  it('"Compra no débito PADARIA" → "PADARIA"', () => {
    expect(sanitizeCounterparty('Compra no débito PADARIA')).toBe('PADARIA')
  })

  it('"Transferência enviada - 12345678" → "12345678"', () => {
    expect(sanitizeCounterparty('Transferência enviada - 12345678')).toBe('12345678')
  })
})
