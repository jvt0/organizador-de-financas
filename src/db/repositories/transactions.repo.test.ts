import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Transaction } from '../../domain/types'

const transactionsStore = new Map<string, Transaction>()

vi.mock('../db', () => ({
  db: {
    transactions: {
      bulkAdd: async (transactions: Transaction[]) => {
        for (const transaction of transactions) {
          transactionsStore.set(transaction.id, transaction)
        }

        return transactions.map((transaction) => transaction.id)
      },
      clear: async () => {
        transactionsStore.clear()
      },
      where: (field: 'fingerprint' | 'fileId') => ({
        anyOf: (values: string[]) => ({
          toArray: async () =>
            Array.from(transactionsStore.values()).filter((transaction) => values.includes(transaction[field])),
        }),
        equals: (value: string) => ({
          delete: async () => {
            let deletedCount = 0

            for (const [id, transaction] of transactionsStore.entries()) {
              if (transaction[field] === value) {
                transactionsStore.delete(id)
                deletedCount += 1
              }
            }

            return deletedCount
          },
          sortBy: async (sortField: 'dateTs') =>
            Array.from(transactionsStore.values())
              .filter((transaction) => transaction[field] === value)
              .sort((a, b) => a[sortField] - b[sortField]),
        }),
      }),
    },
  },
}))

import { db } from '../db'
import {
  bulkAddTransactions,
  deleteTransactionsByFileId,
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
    amount: 100,
    direction: 'out',
    description: 'Pix enviado',
    fingerprint: 'fp-1',
    possibleDuplicateKey: 'dup-1',
    ...overrides,
  }
}

describe('transactions.repo', () => {
  beforeEach(async () => {
    await db.transactions.clear()
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
