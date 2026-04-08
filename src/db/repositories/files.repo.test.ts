import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImportedFile } from '../../domain/types'

const filesStore = new Map<string, ImportedFile>()

vi.mock('../db', () => ({
  db: {
    files: {
      add: async (file: ImportedFile) => {
        filesStore.set(file.id, file)
        return file.id
      },
      get: async (id: string) => filesStore.get(id),
      delete: async (id: string) => {
        filesStore.delete(id)
      },
      clear: async () => {
        filesStore.clear()
      },
      where: (field: 'hash') => ({
        equals: (value: string) => ({
          first: async () => {
            for (const file of filesStore.values()) {
              if (file[field] === value) {
                return file
              }
            }

            return undefined
          },
        }),
      }),
    },
  },
}))

import { db } from '../db'
import { addFile, deleteFileById, getFileByHash, getFileById } from './files.repo'

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
})
