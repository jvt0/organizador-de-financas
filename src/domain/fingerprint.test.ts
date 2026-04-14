import { describe, expect, it } from 'vitest'
import {
  buildPossibleDuplicateKey,
  buildTransactionFingerprint,
  normalizeDateToUtcDayTimestamp,
  normalizeFingerprintText,
  normalizePositiveAmountUnits,
} from './fingerprint'
import { normalizeDescription } from '../normalization/description'

// ─── normalizeFingerprintText ────────────────────────────────────────────────
describe('normalizeFingerprintText', () => {
  it('normaliza acentos, case e espaços', () => {
    expect(normalizeFingerprintText('  João   Silva  ')).toBe('joao silva')
  })

  it('colapsa múltiplos espaços internos para um único', () => {
    // Garante que "PIX  enviado" e "PIX enviado" produzem a mesma representação
    expect(normalizeFingerprintText('PIX  enviado')).toBe('pix enviado')
    expect(normalizeFingerprintText('PIX  enviado')).toBe(normalizeFingerprintText('PIX enviado'))
  })

  it('preserva emoji — emoji NÃO é removido pelo fingerprint (diferente de descriptionNormalized)', () => {
    // A remoção de emoji é responsabilidade de normalizeDescription (clustering),
    // não do fingerprint. Dois registros, um com ☕ e outro sem, são transações distintas.
    const comEmoji    = normalizeFingerprintText('☕ Cafezinho')
    const semEmoji    = normalizeFingerprintText('Cafezinho')
    expect(comEmoji).toContain('☕')
    expect(comEmoji).not.toBe(semEmoji)
  })

  it('preserva dígitos — códigos NSU/TX são parte do fingerprint (diferente de descriptionNormalized)', () => {
    // O fingerprint diferencia "PIX 123456" de "PIX 789012" (transações distintas).
    // A normalizeDescription trata ambas como o mesmo cluster ("pix").
    const comCodigo   = normalizeFingerprintText('PIX 123456 mercado')
    const outCodigo   = normalizeFingerprintText('PIX 789012 mercado')
    expect(comCodigo).not.toBe(outCodigo)
  })

  it('string vazia normalizada retorna string vazia', () => {
    expect(normalizeFingerprintText('')).toBe('')
  })
})

// ─── normalizeFingerprintText vs normalizeDescription — divergência chave ────
describe('divergência: normalizeFingerprintText ≠ normalizeDescription', () => {
  it('mesmo estabelecimento com códigos diferentes → fingerprints distintos, cluster igual', () => {
    // Cenário real: duas compras na mesma padaria em dias diferentes,
    // o banco embute o NSU (6+ dígitos) na descrição.
    const desc1 = 'PADARIA ALFA 123456'
    const desc2 = 'PADARIA ALFA 789012'

    // Fingerprints DEVEM ser diferentes — são transações diferentes
    expect(normalizeFingerprintText(desc1)).not.toBe(normalizeFingerprintText(desc2))

    // Cluster key DEVE ser o mesmo — é o mesmo estabelecimento
    expect(normalizeDescription(desc1)).toBe(normalizeDescription(desc2))
    expect(normalizeDescription(desc1)).toBe('padaria alfa')
  })

  it('emoji na descrição → fingerprint diferente, cluster igual', () => {
    const comEmoji = 'PADARIA ☕ CENTRAL'
    const semEmoji = 'PADARIA CENTRAL'

    // Fingerprints distintos (tratados como transações diferentes — comportamento conservador)
    expect(normalizeFingerprintText(comEmoji)).not.toBe(normalizeFingerprintText(semEmoji))

    // Mesmo cluster (para insights/agrupamento, emoji é ruído)
    expect(normalizeDescription(comEmoji)).toBe(normalizeDescription(semEmoji))
    expect(normalizeDescription(semEmoji)).toBe('padaria central')
  })
})

// ─── normalizePositiveAmountUnits ───────────────────────────────────────────
describe('normalizePositiveAmountUnits', () => {
  it('serializa inteiro positivo para string', () => {
    expect(normalizePositiveAmountUnits(1000)).toBe('1000')
    expect(normalizePositiveAmountUnits(1)).toBe('1')
    expect(normalizePositiveAmountUnits(999999)).toBe('999999')
  })

  it('serializa 1 centavo (valor mínimo BRL)', () => {
    expect(normalizePositiveAmountUnits(1)).toBe('1')
  })

  it('serializa valor de R$1.000.000,00 (100_000_000 centavos)', () => {
    expect(normalizePositiveAmountUnits(100_000_000)).toBe('100000000')
  })

  it('lança erro para float, zero ou negativo', () => {
    expect(() => normalizePositiveAmountUnits(10.5)).toThrow('positive integer')
    expect(() => normalizePositiveAmountUnits(0)).toThrow('positive integer')
    expect(() => normalizePositiveAmountUnits(-100)).toThrow('positive integer')
  })

  it('lança erro para NaN e Infinity', () => {
    expect(() => normalizePositiveAmountUnits(NaN)).toThrow('positive integer')
    expect(() => normalizePositiveAmountUnits(Infinity)).toThrow('positive integer')
  })
})

// ─── normalizeDateToUtcDayTimestamp ─────────────────────────────────────────
describe('normalizeDateToUtcDayTimestamp', () => {
  it('stripa o componente de horário — retorna meia-noite UTC', () => {
    // 2024-03-15T14:30:00 UTC → deve retornar o timestamp de 2024-03-15T00:00:00 UTC
    const withTime = Date.UTC(2024, 2, 15, 14, 30, 0)
    const result   = normalizeDateToUtcDayTimestamp(withTime)
    expect(result).toBe(Date.UTC(2024, 2, 15, 0, 0, 0))
  })

  it('não altera um timestamp que já é meia-noite UTC', () => {
    const midnight = Date.UTC(2024, 2, 15)
    expect(normalizeDateToUtcDayTimestamp(midnight)).toBe(midnight)
  })

  it('funciona corretamente no último dia do ano', () => {
    const dec31 = Date.UTC(2024, 11, 31, 23, 59, 59)
    expect(normalizeDateToUtcDayTimestamp(dec31)).toBe(Date.UTC(2024, 11, 31))
  })
})

// ─── buildTransactionFingerprint ────────────────────────────────────────────
describe('buildTransactionFingerprint', () => {
  it('gera a mesma fingerprint para descrições semanticamente iguais na mesma linha', () => {
    const a = buildTransactionFingerprint({
      amountInUnits: 10000,
      dateTs: Date.UTC(2024, 2, 15),
      direction: 'out',
      description: 'PIX   Enviado',
      sourceRowId: 'row-0',
    })

    const b = buildTransactionFingerprint({
      amountInUnits: 10000,
      dateTs: Date.UTC(2024, 2, 15),
      direction: 'out',
      description: 'pix enviado',
      sourceRowId: 'row-0',
    })

    expect(a).toBe(b)
  })

  it('é determinístico: mesmos inputs em chamadas separadas geram o mesmo hash', () => {
    const input = {
      amountInUnits: 5000,
      dateTs: Date.UTC(2024, 5, 1),
      direction: 'in' as const,
      description: 'Salário',
      sourceRowId: 'row-42',
    }
    // Não deve depender de estado global — duas chamadas idênticas = mesmo resultado
    expect(buildTransactionFingerprint(input)).toBe(buildTransactionFingerprint(input))
  })

  it('muda o fingerprint ao alterar qualquer campo (sensibilidade)', () => {
    const base = {
      amountInUnits: 10000,
      dateTs: Date.UTC(2024, 2, 15),
      direction: 'out' as const,
      description: 'Pix enviado',
      sourceRowId: 'row-1',
    }
    const original = buildTransactionFingerprint(base)

    expect(buildTransactionFingerprint({ ...base, amountInUnits: 10001 })).not.toBe(original)
    expect(buildTransactionFingerprint({ ...base, dateTs: Date.UTC(2024, 2, 16) })).not.toBe(original)
    expect(buildTransactionFingerprint({ ...base, direction: 'in' })).not.toBe(original)
    expect(buildTransactionFingerprint({ ...base, description: 'Pix recebido' })).not.toBe(original)
    expect(buildTransactionFingerprint({ ...base, sourceRowId: 'row-2' })).not.toBe(original)
  })

  it('gera fingerprints distintos para transações idênticas em linhas diferentes', () => {
    const cafe1 = buildTransactionFingerprint({
      amountInUnits: 500,
      dateTs: Date.UTC(2024, 3, 1),
      direction: 'out',
      description: 'Cafezinho',
      sourceRowId: 'row-3',
    })

    const cafe2 = buildTransactionFingerprint({
      amountInUnits: 500,
      dateTs: Date.UTC(2024, 3, 1),
      direction: 'out',
      description: 'Cafezinho',
      sourceRowId: 'row-7',
    })

    expect(cafe1).not.toBe(cafe2)
  })

  it('retorna string no formato fp_XXXXXXXX (prefixo + hex de 8 dígitos)', () => {
    const fp = buildTransactionFingerprint({
      amountInUnits: 1,
      dateTs: Date.UTC(2024, 0, 1),
      direction: 'out',
      description: 'teste',
      sourceRowId: 'row-0',
    })
    expect(fp).toMatch(/^fp_[0-9a-f]{8}$/)
  })
})

// ─── buildPossibleDuplicateKey ───────────────────────────────────────────────
describe('buildPossibleDuplicateKey', () => {
  it('gera a mesma chave para mesma data, valor e direção', () => {
    const a = buildPossibleDuplicateKey({
      amountInUnits: 10000,
      dateTs: Date.UTC(2024, 2, 15),
      direction: 'out',
    })

    const b = buildPossibleDuplicateKey({
      amountInUnits: 10000,
      dateTs: Date.UTC(2024, 2, 15),
      direction: 'out',
    })

    expect(a).toBe(b)
  })

  it('ignora descrição e sourceRowId — é uma chave de suspeita, não de identidade', () => {
    // Dois registros com valores iguais no mesmo dia são "suspeitos de duplicata"
    // mas ainda são identidades distintas (o fingerprint, que inclui descrição e sourceRowId, difere).
    const key1 = buildPossibleDuplicateKey({ amountInUnits: 500, dateTs: Date.UTC(2024, 3, 1), direction: 'out' })
    const key2 = buildPossibleDuplicateKey({ amountInUnits: 500, dateTs: Date.UTC(2024, 3, 1), direction: 'out' })
    expect(key1).toBe(key2)
  })
})
