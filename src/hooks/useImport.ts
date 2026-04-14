import { useCallback, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { parseInterCsv } from '../importers/inter.parser'
import { parseNubankCsv } from '../importers/nubank.parser'
import { runImportPipeline, type ImportResult } from '../pipeline/import.pipeline'
import type { SourceType } from '../domain/types'

// ─── Constraints ─────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXTENSIONS = ['.csv']

// ─── State Machine ────────────────────────────────────────────────────────────
// IDLE → UPLOADING → PROCESSING → SUCCESS
//                              ↘ ERROR (de qualquer etapa)
export type ImportState =
  | { phase: 'IDLE' }
  | { phase: 'UPLOADING';   fileName: string; progress: number }
  | { phase: 'PROCESSING';  fileName: string }
  | { phase: 'SUCCESS';     fileName: string; result: ImportResult }
  | { phase: 'ERROR';       fileName: string; message: string }

export type UseImportResult = {
  state: ImportState
  isLocked: boolean
  importFile: (file: File, sourceType?: SourceType) => Promise<void>
  reset: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function detectSourceType(text: string, fileName: string): SourceType {
  const lower = fileName.toLowerCase()
  if (lower.includes('nubank') || lower.includes('nu_')) return 'nubank'
  if (lower.includes('inter')) return 'inter'

  const firstLine = text.split('\n')[0]?.toLowerCase() ?? ''
  if (firstLine.includes('identificador') || firstLine.includes('descrição') && firstLine.includes('valor')) {
    return 'nubank'
  }
  if (firstLine.includes('data lançamento') || firstLine.includes('histórico')) return 'inter'

  return 'inter'
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function validateFile(file: File): string | null {
  if (file.size === 0) return 'O arquivo está vazio.'
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return `Arquivo muito grande: ${mb} MB. O limite é 10 MB.`
  }
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Formato inválido (${ext || 'sem extensão'}). Envie um arquivo .csv.`
  }
  return null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useImport(): UseImportResult {
  const [state, setState] = useState<ImportState>({ phase: 'IDLE' })
  const locked = useRef(false)

  const importFile = useCallback(async (file: File, sourceTypeHint?: SourceType) => {
    if (locked.current) return
    locked.current = true

    // ── UPLOADING: validação + leitura do arquivo ──────────────────────────
    setState({ phase: 'UPLOADING', fileName: file.name, progress: 0 })

    try {
      const error = validateFile(file)
      if (error) {
        setState({ phase: 'ERROR', fileName: file.name, message: error })
        return
      }

      setState({ phase: 'UPLOADING', fileName: file.name, progress: 40 })
      const text = await file.text()

      setState({ phase: 'UPLOADING', fileName: file.name, progress: 70 })
      const hash = await hashFile(file)

      setState({ phase: 'UPLOADING', fileName: file.name, progress: 100 })

      // ── PROCESSING: parsing + pipeline DB ─────────────────────────────────
      setState({ phase: 'PROCESSING', fileName: file.name })

      const sourceType: SourceType = sourceTypeHint ?? detectSourceType(text, file.name)
      const transactions =
        sourceType === 'nubank'
          ? parseNubankCsv(text, file.name)
          : parseInterCsv(text, file.name)

      if (transactions.length === 0) {
        setState({
          phase: 'ERROR',
          fileName: file.name,
          message: 'Nenhuma transação encontrada no arquivo.',
        })
        return
      }

      const result = await runImportPipeline({
        file: {
          id: nanoid(),
          name: file.name,
          sourceType,
          hash,
          uploadedAt: new Date().toISOString(),
        },
        transactions,
      })

      // ── SUCCESS ────────────────────────────────────────────────────────────
      setState({ phase: 'SUCCESS', fileName: file.name, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido.'
      setState({ phase: 'ERROR', fileName: file.name, message })
    } finally {
      locked.current = false
    }
  }, [])

  const reset = useCallback(() => {
    if (!locked.current) setState({ phase: 'IDLE' })
  }, [])

  return { state, isLocked: locked.current, importFile, reset }
}
