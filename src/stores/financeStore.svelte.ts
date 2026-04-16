import { nanoid } from 'nanoid'
import { runImportPipeline, type StructuredImportTransaction } from '../pipeline/import.pipeline'
import { parseInterCsv } from '../importers/inter.parser'
import { parseNubankCsv } from '../importers/nubank.parser'
import { findAll, clearAll as dbClearAll } from '../db/repositories/transactions.repo'
import { deleteFile } from '../db/repositories/files.repo'
import { db } from '../db/db'
import { toDecimal } from '../utils/money'
import type { ImportedFile, SourceType, Transaction } from '../domain/types'

// ── View models ────────────────────────────────────────────────────────────────

/** Representação da transação adaptada para a camada de View. */
export interface TransacaoView {
  data: string        // ISO 'yyyy-MM-dd' — mantido para ordenação correta por localeCompare
  destinatario: string
  descricao: string
  valor: number       // float com sinal: positivo = entrada, negativo = saída
  banco_origem: string
  propria: boolean
}

/** Representação do arquivo carregado adaptada para a camada de View. */
export interface ArquivoView {
  id: string
  nome: string
  meta: string
  status: 'ok' | 'warn' | 'err'
}

// ── Helpers privados ───────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function detectSource(csvText: string): SourceType | null {
  // Remove BOM (\uFEFF) e carriage returns (\r) antes de qualquer análise —
  // exports reais do Inter/Nubank (Windows/Mac/Excel) costumam incluir esses bytes invisíveis
  const clean  = csvText.replace(/^\uFEFF/, '').replace(/\r/g, '')
  const firstLine = clean.split('\n')[0]
  const sample = clean.slice(0, 2000).toLowerCase()

  // Inter: cabeçalho contém "data lançamento"
  if (sample.includes('data lan\u00e7amento') || sample.includes('data lancamento')) return 'inter'
  // Nubank: cabeçalho contém "identificador" (Data,Valor,Identificador,Descrição)
  if (sample.includes('identificador')) return 'nubank'

  console.log('[DEBUG] Falha na detecção. Header lido:', firstLine)
  console.log('[DEBUG] Char codes da primeira linha:', [...firstLine].map(c => c.charCodeAt(0)))
  return null
}

function txToView(tx: Transaction): TransacaoView {
  const sign = tx.direction === 'in' ? 1 : -1
  return {
    data:         tx.date,                              // ISO yyyy-MM-dd
    destinatario: tx.counterparty ?? tx.description,
    descricao:    tx.description,
    valor:        sign * toDecimal(tx.amountInUnits, tx.precision),
    banco_origem: tx.bankName ?? tx.source,
    propria:      tx.ownTransfer ?? false,
  }
}

function fileToView(f: ImportedFile): ArquivoView {
  const source =
    f.sourceType === 'inter'  ? 'Inter'    :
    f.sourceType === 'nubank' ? 'Nubank'   : 'Genérico'
  const n = f.validRowCount
  return {
    id:     f.id,
    nome:   f.name,
    meta:   `${source} · ${n} transa${n !== 1 ? 'ções' : 'ção'}`,
    status: f.ignoredRowCount > 0 ? 'warn' : 'ok',
  }
}

// ── Store factory ──────────────────────────────────────────────────────────────

function createFinanceStore() {
  let transacoes = $state<TransacaoView[]>([])
  let arquivos   = $state<ArquivoView[]>([])
  let loading    = $state(false)
  let error      = $state<string | null>(null)

  // Busca dados frescos do Dexie e atualiza os arrays reativos
  async function loadData(): Promise<void> {
    const [txs, files] = await Promise.all([findAll(), db.files.toArray()])
    transacoes = txs.map(txToView)
    arquivos   = files.map(fileToView)
    console.log('[DEBUG] 6. Estado global atualizado! Transações no state:', transacoes.length)
  }

  // ── Write → Fetch → Update State ───────────────────────────────────────────
  async function processUpload(fileList: FileList): Promise<void> {
    loading = true
    error   = null
    const errs: string[] = []

    for (const file of Array.from(fileList)) {
      console.log('[DEBUG] 1. Arquivo recebido na UI:', file.name)
      try {
        console.log('[DEBUG] 2. Store iniciou processamento do arquivo')

        // file.text() — API nativa do browser, lê o File como UTF-8 sem callbacks
        const rawText = await file.text()
        // Limpeza pesada: remove BOM e \r para que detecção e parsers recebam texto uniforme
        const text = rawText.replace(/^\uFEFF/, '').replace(/\r/g, '')
        console.log('[DEBUG] 3. Texto do CSV extraído, tamanho:', text.length)

        const hash   = await sha256(text)
        const source = detectSource(text)

        if (!source) {
          const msg = `${file.name}: formato não reconhecido (esperado Inter ou Nubank CSV)`
          console.error('[DEBUG] detectSource falhou:', msg)
          errs.push(msg)
          continue
        }

        console.log(`[DEBUG] Formato detectado: ${source} para ${file.name}`)

        const parsed: StructuredImportTransaction[] =
          source === 'inter'
            ? parseInterCsv(text, file.name)
            : parseNubankCsv(text, file.name)

        if (parsed.length === 0) {
          const msg = `${file.name}: nenhuma transação encontrada no arquivo`
          console.warn('[DEBUG] Parser retornou vazio:', msg)
          errs.push(msg)
          continue
        }

        console.log('[DEBUG] 4. Enviando para o pipeline de importação...')

        const importedFile: Omit<ImportedFile, 'rowCount' | 'validRowCount' | 'ignoredRowCount'> = {
          id:         nanoid(),
          name:       file.name,
          sourceType: source,
          hash,
          uploadedAt: new Date().toISOString(),
        }

        // CAUSA RAIZ CORRIGIDA: ambos os parsers (Inter e Nubank) retornam datas em
        // formato dd/MM/yyyy. O normalizeTransactionDate lança "Ambiguous date string"
        // para qualquer data não-ISO sem dateFormat explícito. Passamos 'dd/MM/yyyy'
        // para que a normalização parse corretamente.
        const result = await runImportPipeline({
          file: importedFile,
          transactions: parsed,
          options: { dateFormat: 'dd/MM/yyyy' },
        })

        console.log('[DEBUG] 5. Pipeline finalizou. Registros gerados:', result.newCount, '| Duplicatas bloqueadas:', result.duplicateCount)

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[DEBUG] Erro ao processar ${file.name}:`, e)
        errs.push(`${file.name}: ${msg}`)
      }
    }

    // Busca dados frescos do Dexie SOMENTE APÓS todas as gravações concluírem
    try {
      await loadData()
    } catch (e: unknown) {
      console.error('[DEBUG] Erro ao carregar dados após importação:', e)
    }

    loading = false
    if (errs.length > 0) error = errs.join('\n')
  }

  // ── Delete from DB → Update State ──────────────────────────────────────────
  async function removeFile(id: string): Promise<void> {
    try {
      // deleteFile é atômico: remove arquivo + todas as transações vinculadas em uma tx Dexie
      await deleteFile(id)
      await loadData()
    } catch (e: unknown) {
      console.error('[DEBUG] Erro ao remover arquivo:', e)
    }
  }

  async function clearAll(): Promise<void> {
    try {
      // dbClearAll limpa db.transactions E db.files atomicamente
      await dbClearAll()
    } catch (e: unknown) {
      console.error('[DEBUG] Erro ao limpar banco:', e)
    }
    transacoes = []
    arquivos   = []
  }

  // Carrega dados persistidos ao inicializar (IndexedDB persiste entre recargas)
  loadData().catch((e) => console.error('[DEBUG] Erro no loadData inicial:', e))

  return {
    get transacoes() { return transacoes },
    get arquivos()   { return arquivos },
    get loading()    { return loading },
    get error()      { return error },
    processUpload,
    removeFile,
    clearAll,
  }
}

export const financeStore = createFinanceStore()
