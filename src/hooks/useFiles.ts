import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { ImportedFile } from '../domain/types'

export type UseFilesResult = {
  files: ImportedFile[]
  isLoading: boolean
  count: number
}

export function useFiles(): UseFilesResult {
  const files = useLiveQuery(() =>
    db.files.orderBy('uploadedAt').reverse().toArray()
  )

  return {
    files: files ?? [],
    isLoading: files === undefined,
    count: files?.length ?? 0,
  }
}
