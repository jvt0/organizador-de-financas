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

  it('lança erro para data inválida do calendário: 31/02/2024 não existe', () => {
    expect(() => normalizeTransactionDate('31/02/2024', 'dd/MM/yyyy')).toThrow()
  })

  it('lança erro para Date inválido', () => {
    expect(() => normalizeTransactionDate(new Date('invalid'))).toThrow()
  })

  // ── Datas de borda do calendário ─────────────────────────────────────────
  it('aceita 29/02/2024 — 2024 é ano bissexto', () => {
    const result = normalizeTransactionDate('29/02/2024', 'dd/MM/yyyy')
    expect(result.date).toBe('2024-02-29')
    expect(result.dateTs).toBe(Date.UTC(2024, 1, 29))
  })

  it('lança erro para 29/02/2023 — 2023 não é ano bissexto', () => {
    expect(() => normalizeTransactionDate('29/02/2023', 'dd/MM/yyyy')).toThrow()
  })

  it('aceita 31/12/2024 — último dia do ano', () => {
    const result = normalizeTransactionDate('31/12/2024', 'dd/MM/yyyy')
    expect(result.date).toBe('2024-12-31')
    expect(result.dateTs).toBe(Date.UTC(2024, 11, 31))
  })

  it('lança erro para 30/02/2024 — fevereiro nunca tem 30 dias', () => {
    expect(() => normalizeTransactionDate('30/02/2024', 'dd/MM/yyyy')).toThrow()
  })

  it('stripa componente de horário — dateTs é sempre meia-noite UTC', () => {
    // Um timestamp às 14h30 UTC deve resultar em meia-noite UTC do mesmo dia
    const tsComHorario = Date.UTC(2024, 5, 15, 14, 30, 0)
    const result       = normalizeTransactionDate(tsComHorario)
    expect(result.dateTs).toBe(Date.UTC(2024, 5, 15, 0, 0, 0))
    expect(result.date).toBe('2024-06-15')
  })

  it('lança erro para mês 13 (inválido)', () => {
    // '13/13/2024' com formato MM/dd/yyyy: mês 13 → inválido
    expect(() => normalizeTransactionDate('13/40/2024', 'MM/dd/yyyy')).toThrow()
  })
})
