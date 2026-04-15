import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImportedFile } from '../../domain/types'
import { db } from '../db'
import { addFile, deleteFile, deleteFileById, getFileByHash, getFileById } from './files.repo'

function makeImportedFile(overrides: Partial<ImportedFile> = {}): ImportedFile {
  return {
    id: 'file-1',
    name: 'extrato.csv',
    sourceType: 'inter',
    hash: 'hash-1',
    uploadedAt: '2024-03-15T10:00:00.000Z',
    rowCount: 10,
    validRowCount: 8,
    ignoredRowCount: 2,
    ...overrides,
  }
}

describe('files.repo', () => {
  beforeEach(async () => {
    await db.files.clear()
    await db.transactions.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adiciona arquivo e consulta por hash e id', async () => {
    const file = makeImportedFile()

    await addFile(file)

    await expect(getFileByHash(file.hash)).resolves.toEqual(file)
    await expect(getFileById(file.id)).resolves.toEqual(file)
  })

  it('remove arquivo pelo id', async () => {
    const file = makeImportedFile()

    await addFile(file)
    await deleteFileById(file.id)

    await expect(getFileById(file.id)).resolves.toBeUndefined()
    await expect(getFileByHash(file.hash)).resolves.toBeUndefined()
  })

  it('getFileByHash retorna undefined para hash inexistente', async () => {
    await expect(getFileByHash('hash-fantasma')).resolves.toBeUndefined()
  })

  it('getFileById retorna undefined para id inexistente', async () => {
    await expect(getFileById('id-fantasma')).resolves.toBeUndefined()
  })

  it('deleteFile de arquivo inexistente resolve sem lançar erro', async () => {
    // IndexedDB silencia deletes de registros que não existem — comportamento esperado
    await expect(deleteFile('fantasma')).resolves.toBeUndefined()
    expect(await db.files.count()).toBe(0)
  })

  it('armazena uploadedAt com precisão de milissegundo (vi.setSystemTime)', async () => {
    const FIXED_TS = '2025-06-15T14:30:00.000Z'
    vi.setSystemTime(new Date(FIXED_TS))

    const file = makeImportedFile({
      id: 'time-file',
      hash: 'time-hash',
      uploadedAt: new Date().toISOString(),
    })
    await addFile(file)

    const found = await getFileById('time-file')
    expect(found?.uploadedAt).toBe(FIXED_TS)
  })

  it('getFileByHash retorna somente o arquivo com o hash exato quando há múltiplos arquivos', async () => {
    await addFile(makeImportedFile({ id: 'f-alpha', hash: 'hash-alpha' }))
    await addFile(makeImportedFile({ id: 'f-beta',  hash: 'hash-beta'  }))

    const alpha = await getFileByHash('hash-alpha')
    const beta  = await getFileByHash('hash-beta')

    expect(alpha?.id).toBe('f-alpha')
    expect(beta?.id).toBe('f-beta')
    // hash-alpha não deve ser confundido com hash-beta
    expect(alpha?.id).not.toBe(beta?.id)
  })

  it('deleteFile remove o arquivo e todas as transações vinculadas atomicamente', async () => {
    const file = makeImportedFile({ id: 'file-cascade', hash: 'hash-cascade' })
    await addFile(file)

    // Insere 3 transações vinculadas ao arquivo (amountInUnits: 1000 = R$10,00 em centavos)
    await db.transactions.bulkAdd([
      {
        id: 'tx-A', fileId: 'file-cascade', source: 'inter' as const,
        date: '2024-01-01', dateTs: Date.UTC(2024, 0, 1),
        amountInUnits: 1000, currency: 'BRL', precision: 2,
        direction: 'out' as const,
        description: 'Cafe', descriptionNormalized: 'cafe', sourceRowId: 'row-0',
        fingerprint: 'fp-A', possibleDuplicateKey: 'dup-A',
      },
      {
        id: 'tx-B', fileId: 'file-cascade', source: 'inter' as const,
        date: '2024-01-01', dateTs: Date.UTC(2024, 0, 1),
        amountInUnits: 1000, currency: 'BRL', precision: 2,
        direction: 'out' as const,
        description: 'Cafe', descriptionNormalized: 'cafe', sourceRowId: 'row-1',
        fingerprint: 'fp-B', possibleDuplicateKey: 'dup-B',
      },
      {
        id: 'tx-C', fileId: 'file-cascade', source: 'inter' as const,
        date: '2024-01-01', dateTs: Date.UTC(2024, 0, 1),
        amountInUnits: 1000, currency: 'BRL', precision: 2,
        direction: 'out' as const,
        description: 'Cafe', descriptionNormalized: 'cafe', sourceRowId: 'row-2',
        fingerprint: 'fp-C', possibleDuplicateKey: 'dup-C',
      },
    ])

    expect(await db.transactions.count()).toBe(3)

    // Rollback do usuário: remove arquivo + transações
    await deleteFile('file-cascade')

    // Arquivo removido
    await expect(getFileById('file-cascade')).resolves.toBeUndefined()

    // Todas as transações vinculadas removidas
    const restantes = await db.transactions.where('fileId').equals('file-cascade').toArray()
    expect(restantes).toHaveLength(0)
    expect(await db.transactions.count()).toBe(0)
  })
})
