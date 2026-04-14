import { describe, expect, it } from 'vitest'
import {
  normalizeAmountWithDirection,
  normalizeTransactionAmount,
  parseMonetaryAmount,
} from './amount'
import { toUnits } from '../utils/money'

describe('parseMonetaryAmount', () => {
  it('retorna número finito sem alterar', () => {
    expect(parseMonetaryAmount(123.45)).toBe(123.45)
  })

  it('lança erro para NaN', () => {
    expect(() => parseMonetaryAmount(Number.NaN)).toThrow()
  })

  it('lança erro para Infinity', () => {
    expect(() => parseMonetaryAmount(Number.POSITIVE_INFINITY)).toThrow()
  })

  it('faz parse de valor com vírgula decimal', () => {
    expect(parseMonetaryAmount('123,45')).toBe(123.45)
  })

  it('faz parse de valor com ponto decimal', () => {
    expect(parseMonetaryAmount('123.45')).toBe(123.45)
  })

  it('faz parse de valor com milhar e vírgula decimal', () => {
    expect(parseMonetaryAmount('1.234,56')).toBe(1234.56)
  })

  it('faz parse de valor com milhar e ponto decimal', () => {
    expect(parseMonetaryAmount('1,234.56')).toBe(1234.56)
  })

  it('trata separador único com 3 dígitos após como milhar', () => {
    expect(parseMonetaryAmount('1.234')).toBe(1234)
    expect(parseMonetaryAmount('1,234')).toBe(1234)
  })

  it('interpreta valor entre parênteses como negativo', () => {
    expect(parseMonetaryAmount('(123,45)')).toBe(-123.45)
  })

  it('interpreta sinal de menos como negativo', () => {
    expect(parseMonetaryAmount('-123,45')).toBe(-123.45)
  })

  it('ignora símbolo monetário e espaços', () => {
    expect(parseMonetaryAmount('R$ 1.234,56')).toBe(1234.56)
  })

  it('remove espaços internos antes de parsear', () => {
    expect(parseMonetaryAmount('1 234,56')).toBe(1234.56)
  })

  it('lança erro para string vazia', () => {
    expect(() => parseMonetaryAmount('   ')).toThrow()
  })

  it('lança erro quando não há dígitos', () => {
    expect(() => parseMonetaryAmount('abc')).toThrow()
  })

  it('lança erro para valor malformado com separador no fim', () => {
    expect(() => parseMonetaryAmount('123,')).toThrow()
    expect(() => parseMonetaryAmount('123.')).toThrow()
  })

  // ── Valores extremos (Money Pattern) ────────────────────────────────────────
  it('1 centavo (R$0,01) — valor mínimo BRL', () => {
    expect(parseMonetaryAmount('0,01')).toBe(0.01)
    expect(parseMonetaryAmount('0.01')).toBe(0.01)
  })

  it('R$1.000.000,00 — valor alto sem drift', () => {
    expect(parseMonetaryAmount('1.000.000,00')).toBe(1_000_000)
    expect(parseMonetaryAmount('1,000,000.00')).toBe(1_000_000)
  })

  it('R$999.999,99 — um centavo abaixo de 1 milhão', () => {
    expect(parseMonetaryAmount('999.999,99')).toBe(999_999.99)
  })

  it('valor negativo alto: -R$1.000.000,00', () => {
    expect(parseMonetaryAmount('-1.000.000,00')).toBe(-1_000_000)
  })
})

// ─── Roundtrip: parseMonetaryAmount → toUnits — prova que não há drift ──────
describe('roundtrip parseMonetaryAmount → toUnits (Money Pattern)', () => {
  it('R$0,01 → 1 centavo exato (sem drift de float)', () => {
    const float = parseMonetaryAmount('0,01') // 0.01
    const units = toUnits(float)               // Math.round(0.01 * 100) = 1
    expect(units).toBe(1)
    expect(Number.isInteger(units)).toBe(true)
  })

  it('R$9.999,99 → 999999 centavos exatos', () => {
    const float = parseMonetaryAmount('9.999,99')
    const units = toUnits(float)
    expect(units).toBe(999_999)
    expect(Number.isInteger(units)).toBe(true)
  })

  it('R$1.000.000,00 → 100_000_000 centavos exatos', () => {
    const float = parseMonetaryAmount('1.000.000,00')
    const units = toUnits(float)
    expect(units).toBe(100_000_000)
    expect(Number.isInteger(units)).toBe(true)
  })

  it('R$0,10 × 1000 — demonstra ausência de drift que floats introduziriam', () => {
    // Se somássemos 1000 × 0.1 como float: poderia não ser exatamente 100
    // Com toUnits + inteiros: 1000 × 10 centavos = 10000 centavos = R$100,00 exatos
    const unitsPorTx = toUnits(parseMonetaryAmount('0,10')) // deve ser 10
    expect(unitsPorTx).toBe(10)
    const soma = Array.from({ length: 1000 }, () => unitsPorTx).reduce((a, b) => a + b, 0)
    expect(soma).toBe(10_000) // R$100,00 exatos
  })
})

describe('normalizeTransactionAmount', () => {
  it('mantém amount positivo e direction in para entrada padrão', () => {
    expect(normalizeTransactionAmount('123,45')).toEqual({
      amount: 123.45,
      direction: 'in',
    })
  })

  it('mantém amount positivo e direction out para valor negativo', () => {
    expect(normalizeTransactionAmount('-123,45')).toEqual({
      amount: 123.45,
      direction: 'out',
    })
  })

  it('inverte a semântica quando negativeMeansOutflow = false para valor negativo', () => {
    expect(normalizeTransactionAmount('-123,45', false)).toEqual({
      amount: 123.45,
      direction: 'in',
    })
  })

  it('usa direction out para valor positivo quando negativeMeansOutflow = false', () => {
    expect(normalizeTransactionAmount('123,45', false)).toEqual({
      amount: 123.45,
      direction: 'out',
    })
  })

  it('lança erro para valor zero', () => {
    expect(() => normalizeTransactionAmount('0')).toThrow()
  })

  it('1 centavo (R$0,01) é aceito', () => {
    const result = normalizeTransactionAmount('0,01')
    expect(result.amount).toBe(0.01)
    expect(result.direction).toBe('in')
  })

  it('R$1.000.000,00 é aceito sem erro', () => {
    const result = normalizeTransactionAmount('1.000.000,00')
    expect(result.amount).toBe(1_000_000)
    expect(result.direction).toBe('in')
  })
})

describe('normalizeAmountWithDirection', () => {
  it('normaliza valor positivo preservando direction', () => {
    expect(normalizeAmountWithDirection('123,45', 'out')).toEqual({
      amount: 123.45,
      direction: 'out',
    })
  })

  it('aceita valor negativo com direction out e retorna amount positivo', () => {
    expect(normalizeAmountWithDirection('-123,45', 'out')).toEqual({
      amount: 123.45,
      direction: 'out',
    })
  })

  it('lança erro para valor negativo com direction in', () => {
    expect(() => normalizeAmountWithDirection('-123,45', 'in')).toThrow()
  })

  it('lança erro para valor zero', () => {
    expect(() => normalizeAmountWithDirection('0', 'in')).toThrow()
  })

  it('R$0,01 com direction out é aceito', () => {
    const result = normalizeAmountWithDirection('0,01', 'out')
    expect(result.amount).toBe(0.01)
    expect(result.direction).toBe('out')
  })
})
