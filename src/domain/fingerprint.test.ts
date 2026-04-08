import { describe, expect, it } from 'vitest'
import {
  buildPossibleDuplicateKey,
  buildTransactionFingerprint,
  normalizeFingerprintText,
} from './fingerprint'

describe('normalizeFingerprintText', () => {
  it('normaliza acentos, case e espaços', () => {
    expect(normalizeFingerprintText('  João   Silva  ')).toBe('joao silva')
  })
})

describe('buildTransactionFingerprint', () => {
  it('gera a mesma fingerprint para descrições semanticamente iguais', () => {
    const a = buildTransactionFingerprint({
      amount: 100,
      dateTs: Date.UTC(2024, 2, 15),
      direction: 'out',
      description: 'PIX   Enviado',
    })

    const b = buildTransactionFingerprint({
      amount: 100,
      dateTs: Date.UTC(2024, 2, 15),
      direction: 'out',
      description: 'pix enviado',
    })

    expect(a).toBe(b)
  })
})

describe('buildPossibleDuplicateKey', () => {
  it('gera a mesma chave para mesma data, valor e direção', () => {
    const a = buildPossibleDuplicateKey({
      amount: 100,
      dateTs: Date.UTC(2024, 2, 15),
      direction: 'out',
    })

    const b = buildPossibleDuplicateKey({
      amount: 100,
      dateTs: Date.UTC(2024, 2, 15),
      direction: 'out',
    })

    expect(a).toBe(b)
  })
})