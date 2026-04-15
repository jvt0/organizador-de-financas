import { beforeEach, describe, expect, it } from 'vitest'

import type { Transaction } from '../../domain/types'
import { db } from '../db'
import {
  bulkAddTransactions,
  clearAll,
  deleteTransactionsByFileId,
  findAll,
  getExistingFingerprints,
  getTransactionsByFileId,
} from './transactions.repo'

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    fileId: 'file-1',
    source: 'inter',
    date: '2024-03-15',
    dateTs: Date.UTC(2024, 2, 15),
    amountInUnits: 10000, // R$100,00 em centavos
    currency: 'BRL',
    precision: 2,
    direction: 'out',
    description: 'Pix enviado',
    descriptionNormalized: 'pix enviado',
    sourceRowId: 'row-1',
    fingerprint: 'fp-1',
    possibleDuplicateKey: 'dup-1',
    ...overrides,
  }
}

describe('transactions.repo', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.files.clear()
  })

  it('adiciona transacoes em lote e busca por fileId', async () => {
    const transactions = [
      makeTransaction({ id: 'tx-1', fileId: 'file-1', dateTs: Date.UTC(2024, 2, 16), fingerprint: 'fp-1' }),
      makeTransaction({ id: 'tx-2', fileId: 'file-1', dateTs: Date.UTC(2024, 2, 15), fingerprint: 'fp-2' }),
      makeTransaction({ id: 'tx-3', fileId: 'file-2', fingerprint: 'fp-3' }),
    ]

    await bulkAddTransactions(transactions)

    await expect(getTransactionsByFileId('file-1')).resolves.toEqual([
      transactions[1],
      transactions[0],
    ])
  })

  it('retorna apenas fingerprints ja persistidas', async () => {
    await bulkAddTransactions([
      makeTransaction({ id: 'tx-1', fingerprint: 'fp-1' }),
      makeTransaction({ id: 'tx-2', fingerprint: 'fp-2', fileId: 'file-2' }),
    ])

    await expect(getExistingFingerprints(['fp-2', 'fp-3', 'fp-1'])).resolves.toEqual([
      'fp-1',
      'fp-2',
    ])
  })

  it('getExistingFingerprints com array vazio retorna imediatamente array vazio', async () => {
    // O early-return evita uma query desnecessária ao IndexedDB
    await expect(getExistingFingerprints([])).resolves.toEqual([])
  })

  it('getExistingFingerprints com fingerprints não persistidos retorna array vazio', async () => {
    await expect(getExistingFingerprints(['fp-inexistente-1', 'fp-inexistente-2'])).resolves.toEqual([])
  })

  it('findAll retorna transações em ordem decrescente de dateTs (mais recente primeiro)', async () => {
    await bulkAddTransactions([
      makeTransaction({ id: 'tx-jan', dateTs: Date.UTC(2024, 0, 1),  fingerprint: 'fp-jan' }),
      makeTransaction({ id: 'tx-jun', dateTs: Date.UTC(2024, 5, 1),  fingerprint: 'fp-jun' }),
      makeTransaction({ id: 'tx-mar', dateTs: Date.UTC(2024, 2, 15), fingerprint: 'fp-mar' }),
    ])

    const result = await findAll()

    expect(result[0].id).toBe('tx-jun') // mais recente
    expect(result[1].id).toBe('tx-mar')
    expect(result[2].id).toBe('tx-jan') // mais antigo
  })

  it('clearAll esvazia transações e arquivos simultaneamente', async () => {
    await db.files.add({ id: 'f-clear', name: 'clear.csv', sourceType: 'inter', hash: 'h-clear',
      uploadedAt: '2024-01-01T00:00:00.000Z', rowCount: 1, validRowCount: 1, ignoredRowCount: 0 })
    await bulkAddTransactions([makeTransaction()])

    expect(await db.transactions.count()).toBe(1)
    expect(await db.files.count()).toBe(1)

    await clearAll()

    expect(await db.transactions.count()).toBe(0)
    expect(await db.files.count()).toBe(0)
  })

  it('Money Pattern: amountInUnits de 1 centavo (R$0,01) armazenado e recuperado sem drift', async () => {
    await bulkAddTransactions([
      makeTransaction({ id: 'tx-1cent', amountInUnits: 1, fingerprint: 'fp-1cent' }),
    ])

    const [tx] = await findAll()
    expect(tx.amountInUnits).toBe(1)
    expect(Number.isInteger(tx.amountInUnits)).toBe(true)
  })

  it('bulkAddTransactions com array vazio resolve sem erro e não altera o banco', async () => {
    await expect(bulkAddTransactions([])).resolves.toBeUndefined()
    expect(await db.transactions.count()).toBe(0)
  })

  it('IndexedDB não impõe chave estrangeira — transação com fileId órfão é aceita (constraint está no pipeline)', async () => {
    // IndexedDB não tem FK nativa. A garantia de integridade é na camada do runImportPipeline:
    // o hash guard + a transação atômica impedem transações sem arquivo correspondente em produção.
    await expect(
      bulkAddTransactions([
        makeTransaction({ id: 'orphan', fileId: 'arquivo-que-nao-existe', fingerprint: 'fp-orphan' }),
      ]),
    ).resolves.toBeUndefined()

    expect(await db.transactions.count()).toBe(1)
    const [orphan] = await findAll()
    expect(orphan.fileId).toBe('arquivo-que-nao-existe')
  })

  it('remove apenas transacoes do arquivo informado', async () => {
    await bulkAddTransactions([
      makeTransaction({ id: 'tx-1', fileId: 'file-1', fingerprint: 'fp-1' }),
      makeTransaction({ id: 'tx-2', fileId: 'file-1', fingerprint: 'fp-2' }),
      makeTransaction({ id: 'tx-3', fileId: 'file-2', fingerprint: 'fp-3' }),
    ])

    await deleteTransactionsByFileId('file-1')

    await expect(getTransactionsByFileId('file-1')).resolves.toEqual([])
    await expect(getTransactionsByFileId('file-2')).resolves.toEqual([
      makeTransaction({ id: 'tx-3', fileId: 'file-2', fingerprint: 'fp-3' }),
    ])
  })
})
