import { describe, expect, it } from 'vitest'
import { normalizeTransactionDate } from './date'

describe('normalizeTransactionDate', () => {
  it('normaliza yyyy-MM-dd para date e dateTs', () => {
    const result = normalizeTransactionDate('2024-03-15', 'yyyy-MM-dd')

    expect(result).toEqual({
      date: '2024-03-15',
      dateTs: Date.UTC(2024, 2, 15),
    })
  })

  it('normaliza dd/MM/yyyy para date e dateTs', () => {
    const result = normalizeTransactionDate('15/03/2024', 'dd/MM/yyyy')

    expect(result).toEqual({
      date: '2024-03-15',
      dateTs: Date.UTC(2024, 2, 15),
    })
  })

  it('normaliza MM/dd/yyyy para date e dateTs', () => {
    const result = normalizeTransactionDate('03/15/2024', 'MM/dd/yyyy')

    expect(result).toEqual({
      date: '2024-03-15',
      dateTs: Date.UTC(2024, 2, 15),
    })
  })

  it('aceita Date como entrada', () => {
    const result = normalizeTransactionDate(new Date(Date.UTC(2024, 2, 15)))

    expect(result).toEqual({
      date: '2024-03-15',
      dateTs: Date.UTC(2024, 2, 15),
    })
  })

  it('aceita timestamp como entrada', () => {
    const result = normalizeTransactionDate(Date.UTC(2024, 2, 15))

    expect(result).toEqual({
      date: '2024-03-15',
      dateTs: Date.UTC(2024, 2, 15),
    })
  })

  it('aceita string ISO datetime sem dateFormat', () => {
    const result = normalizeTransactionDate('2024-03-15T10:30:00.000Z')

    expect(result).toEqual({
      date: '2024-03-15',
      dateTs: Date.UTC(2024, 2, 15),
    })
  })

  it('lança erro para string vazia', () => {
    expect(() => normalizeTransactionDate('   ')).toThrow()
  })

  it('lança erro para data ambígua sem dateFormat', () => {
    expect(() => normalizeTransactionDate('15/03/2024')).toThrow()
  })

  it('lança erro para formato incompatível', () => {
    expect(() => normalizeTransactionDate('2024-03-15', 'dd/MM/yyyy')).toThrow()
  })

  it('lança erro para data inválida do calendário', () => {
    expect(() => normalizeTransactionDate('31/02/2024', 'dd/MM/yyyy')).toThrow()
  })

  it('lança erro para Date inválido', () => {
    expect(() => normalizeTransactionDate(new Date('invalid'))).toThrow()
  })
})