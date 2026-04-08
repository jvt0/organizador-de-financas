import { beforeEach, describe, expect, it } from 'vitest'

import type { Transaction } from '../domain/types'
import { db } from '../db/db'
import { bulkAddTransactions } from '../db/repositories/transactions.repo'
import { filterExactDuplicates } from './deduplication'

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

describe('filterExactDuplicates', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.files.clear()
  })

  it('bloqueia fingerprints ja existentes e duplicatas dentro do lote, aceitando apenas novas', async () => {
    await bulkAddTransactions([
      makeTransaction({ id: 'persisted-1', fileId: 'old-file', fingerprint: 'fp-persisted' }),
    ])

    const batch = [
      makeTransaction({ id: 'batch-1', fileId: 'new-file', fingerprint: 'fp-persisted' }),
      makeTransaction({ id: 'batch-2', fileId: 'new-file', fingerprint: 'fp-new' }),
      makeTransaction({ id: 'batch-3', fileId: 'new-file', fingerprint: 'fp-new' }),
    ]

    const result = await filterExactDuplicates(batch)

    expect(result.acceptedTransactions).toEqual([batch[1]])
    expect(result.blockedTransactions).toEqual([batch[0], batch[2]])
  })
})
