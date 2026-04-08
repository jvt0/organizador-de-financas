import { beforeEach, describe, expect, it } from 'vitest'

import type { Transaction } from '../domain/types'
import { buildTransactionFingerprint } from '../domain/fingerprint'
import { db } from '../db/db'
import { addFile, getFileById } from '../db/repositories/files.repo'
import { getTransactionsByFileId } from '../db/repositories/transactions.repo'
import { runImportPipeline } from './import.pipeline'

function makePersistedTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'persisted-1',
    fileId: 'old-file',
    source: 'inter',
    date: '2024-03-15',
    dateTs: Date.UTC(2024, 2, 15),
    amount: 100,
    direction: 'out',
    description: 'Pix enviado',
    fingerprint: buildTransactionFingerprint({
      amount: 100,
      dateTs: Date.UTC(2024, 2, 15),
      direction: 'out',
      description: 'Pix enviado',
    }),
    possibleDuplicateKey: 'dup-1',
    ...overrides,
  }
}

describe('runImportPipeline', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.files.clear()
  })

  it('persiste o arquivo e apenas as transacoes aceitas, retornando contadores coerentes', async () => {
    await addFile({
      id: 'old-file',
      name: 'old.csv',
      sourceType: 'inter',
      hash: 'old-hash',
      uploadedAt: '2024-03-14T00:00:00.000Z',
      rowCount: 1,
      validRowCount: 1,
      ignoredRowCount: 0,
    })

    await db.transactions.add(makePersistedTransaction())

    const result = await runImportPipeline({
      file: {
        id: 'file-1',
        name: 'novo.csv',
        sourceType: 'inter',
        hash: 'hash-1',
        uploadedAt: '2024-03-16T00:00:00.000Z',
      },
      transactions: [
        {
          id: 'row-1',
          date: '2024-03-15',
          amount: '-100,00',
          description: 'Pix enviado',
          counterparty: 'João Silva',
        },
        {
          id: 'row-2',
          date: '2024-03-20',
          amount: '-250,00',
          description: 'Transferência entre contas',
          counterparty: 'Conta própria',
        },
        {
          id: 'row-3',
          date: '2024-03-20',
          amount: '-250,00',
          description: 'Transferência entre contas',
          counterparty: 'Conta própria',
        },
      ],
    })

    expect(result.totalCount).toBe(3)
    expect(result.acceptedCount).toBe(1)
    expect(result.duplicateCount).toBe(2)
    expect(result.file).toEqual({
      id: 'file-1',
      name: 'novo.csv',
      sourceType: 'inter',
      hash: 'hash-1',
      uploadedAt: '2024-03-16T00:00:00.000Z',
      rowCount: 3,
      validRowCount: 1,
      ignoredRowCount: 2,
    })
    expect(result.acceptedTransactions).toHaveLength(1)
    expect(result.blockedTransactions).toHaveLength(2)

    await expect(getFileById('file-1')).resolves.toEqual(result.file)
    await expect(getTransactionsByFileId('file-1')).resolves.toEqual(result.acceptedTransactions)

    expect(result.acceptedTransactions[0]).toMatchObject({
      id: 'row-2',
      fileId: 'file-1',
      source: 'inter',
      date: '2024-03-20',
      amount: 250,
      direction: 'out',
      description: 'Transferência entre contas',
      counterpartyNormalized: 'conta propria',
      ownTransfer: true,
    })
    expect(result.acceptedTransactions[0].fingerprint).toBeTruthy()
    expect(result.acceptedTransactions[0].possibleDuplicateKey).toBeTruthy()
  })

  it('falha explicitamente quando o hash do arquivo ja existe sem persistir nada novo', async () => {
    await addFile({
      id: 'existing-file',
      name: 'existente.csv',
      sourceType: 'inter',
      hash: 'same-hash',
      uploadedAt: '2024-03-10T00:00:00.000Z',
      rowCount: 1,
      validRowCount: 1,
      ignoredRowCount: 0,
    })

    await expect(
      runImportPipeline({
        file: {
          id: 'new-file',
          name: 'novo.csv',
          sourceType: 'inter',
          hash: 'same-hash',
          uploadedAt: '2024-03-16T00:00:00.000Z',
        },
        transactions: [
          {
            id: 'row-1',
            date: '2024-03-20',
            amount: '-250,00',
            description: 'Transferência entre contas',
            counterparty: 'Conta própria',
          },
        ],
      }),
    ).rejects.toThrow('Imported file with hash "same-hash" already exists.')

    await expect(getFileById('new-file')).resolves.toBeUndefined()
    await expect(getTransactionsByFileId('new-file')).resolves.toEqual([])
    await expect(db.files.count()).resolves.toBe(1)
    await expect(db.transactions.count()).resolves.toBe(0)
  })
})
