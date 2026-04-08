import { describe, expect, it } from 'vitest'
import {
  normalizeAmountWithDirection,
  normalizeTransactionAmount,
  parseMonetaryAmount,
} from './amount'

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
})