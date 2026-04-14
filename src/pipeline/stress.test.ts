/**
 * Stress Tests — Pipeline de Importação
 *
 * Valida comportamento em cenários adversos: falhas atômicas, colisões de fingerprint,
 * carga de dados e determinismo de deduplicação.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Direction } from '../domain/types'
import { db } from '../db/db'
import { getFileByHash } from '../db/repositories/files.repo'
import { findAll } from '../db/repositories/transactions.repo'
import { runImportPipeline, type StructuredImportTransaction } from './import.pipeline'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileInput(id: string, hash: string) {
  return {
    id,
    name: `${id}.csv`,
    sourceType: 'generic' as const,
    hash,
    uploadedAt: new Date().toISOString(),
  }
}

function makeTx(overrides: Partial<StructuredImportTransaction> = {}): StructuredImportTransaction {
  return {
    id: 'row-1',
    date: '2024-06-15',
    amount: 100,
    description: 'Pagamento Generico',
    direction: 'out',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------

describe('Stress Tests: Pipeline de Importação', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.files.clear()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 1. ATOMICIDADE — Rollback em falha de escrita
  // ─────────────────────────────────────────────────────────────────────────
  describe('Atomicidade: rollback completo em falha de escrita', () => {
    it('reverte o registro do arquivo quando bulkAdd falha no meio da transação', async () => {
      // Força o bulkAdd a lançar um erro simulando falha de I/O (disco cheio, quota excedida, etc.)
      const spy = vi
        .spyOn(db.transactions, 'bulkAdd')
        .mockRejectedValueOnce(new Error('QuotaExceededError: disk full'))

      await expect(
        runImportPipeline({
          file: makeFileInput('atomic-file', 'atomic-hash'),
          transactions: [makeTx()],
        }),
      ).rejects.toThrow('QuotaExceededError: disk full')

      // O arquivo NÃO deve ter sido persistido — a transação Dexie reverteu tudo
      const fileNoDb = await getFileByHash('atomic-hash')
      expect(fileNoDb).toBeUndefined()

      // O banco de transações também deve estar vazio
      const txCount = await db.transactions.count()
      expect(txCount).toBe(0)

      spy.mockRestore()
    })

    it('persiste tudo corretamente quando não há falha', async () => {
      const result = await runImportPipeline({
        file: makeFileInput('ok-file', 'ok-hash'),
        transactions: [makeTx(), makeTx({ id: 'row-2', amount: 200, description: 'Outro pagamento' })],
      })

      expect(result.newCount).toBe(2)
      expect(result.duplicateCount).toBe(0)

      const fileNoDb = await getFileByHash('ok-hash')
      expect(fileNoDb).toBeDefined()
      expect(fileNoDb?.validRowCount).toBe(2)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 2. COLISÃO DE FINGERPRINT — Deduplicação cross-bank
  // ─────────────────────────────────────────────────────────────────────────
  describe('Colisão de fingerprint: deduplicação entre bancos distintos', () => {
    it('bloqueia transação do Nubank com mesmos dados semânticos já importada pelo Inter', async () => {
      // Mesma transação do ponto de vista de conteúdo:
      // mesma data, mesmo valor, mesma direção, mesma descrição → mesmo fingerprint
      const sharedTx: StructuredImportTransaction = {
        id: 'row-1',
        date: '2024-06-01',
        amount: 1500,
        description: 'Salario',
        direction: 'in',
      }

      // 1ª importação: Inter
      const resultInter = await runImportPipeline({
        file: makeFileInput('file-inter', 'hash-inter'),
        transactions: [sharedTx],
      })

      expect(resultInter.newCount).toBe(1)
      expect(resultInter.duplicateCount).toBe(0)

      // 2ª importação: Nubank — mesma transação, banco diferente
      const resultNubank = await runImportPipeline({
        file: { ...makeFileInput('file-nubank', 'hash-nubank'), sourceType: 'nubank' },
        transactions: [{ ...sharedTx, id: 'row-A' }],
      })

      expect(resultNubank.newCount).toBe(0)
      expect(resultNubank.duplicateCount).toBe(1)

      // Apenas 1 transação única no banco — não 2
      const total = await db.transactions.count()
      expect(total).toBe(1)
    })

    it('aceita transações que diferem apenas na direção como registros independentes', async () => {
      // Mesmo valor e data, mas direções opostas (débito vs crédito) → fingerprints distintos
      await runImportPipeline({
        file: makeFileInput('file-out', 'hash-out'),
        transactions: [makeTx({ direction: 'out', amount: 500, description: 'Transferencia' })],
      })

      const resultIn = await runImportPipeline({
        file: makeFileInput('file-in', 'hash-in'),
        transactions: [makeTx({ direction: 'in', amount: 500, description: 'Transferencia' })],
      })

      // Direção diferente = fingerprint diferente = transação diferente
      expect(resultIn.newCount).toBe(1)
      expect(await db.transactions.count()).toBe(2)
    })

    it('trata colisão de fingerprint dentro do mesmo lote (duplicata intra-batch)', async () => {
      // Duas linhas idênticas no mesmo arquivo CSV
      const sameTx = makeTx({ amount: 99, description: 'Duplicata no lote' })

      const result = await runImportPipeline({
        file: makeFileInput('file-intrabatch', 'hash-intrabatch'),
        transactions: [sameTx, { ...sameTx, id: 'row-2' }],
      })

      // Apenas 1 das 2 deve ser aceita
      expect(result.newCount).toBe(1)
      expect(result.duplicateCount).toBe(1)
      expect(await db.transactions.count()).toBe(1)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 3. CARGA DE DADOS — 5.000 transações
  // ─────────────────────────────────────────────────────────────────────────
  describe('Carga: importação de 5.000 transações', () => {
    it('importa 5.000 transações únicas sem travar e dentro do limite de tempo', async () => {
      const TOTAL = 5_000
      const THRESHOLD_MS = 5_000

      const transactions: StructuredImportTransaction[] = Array.from({ length: TOTAL }, (_, i) => ({
        id: `row-${i}`,
        // Variamos data, valor e descrição para garantir fingerprints únicos
        date: `2024-${String(Math.floor(i / 28) % 12 + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        amount: i + 1,
        description: `Transacao automatica ${i}`,
        direction: (i % 2 === 0 ? 'out' : 'in') as Direction,
      }))

      const start = performance.now()

      const result = await runImportPipeline({
        file: makeFileInput('load-file', 'load-hash'),
        transactions,
      })

      const elapsed = performance.now() - start

      expect(result.totalCount).toBe(TOTAL)
      expect(result.newCount).toBe(TOTAL)
      expect(result.duplicateCount).toBe(0)
      expect(await db.transactions.count()).toBe(TOTAL)

      // Valida que o pipeline não travou por tempo excessivo
      // Em ambiente de teste (fake-indexeddb) o limite é generoso.
      // Em produção, o bulkAdd em IndexedDB real é mais rápido por ser nativo.
      expect(elapsed).toBeLessThan(THRESHOLD_MS)

      console.log(`[load-test] ${TOTAL} transações importadas em ${elapsed.toFixed(1)}ms`)
    })

    it('re-importa o mesmo lote de 5.000 e bloqueia tudo como duplicata', async () => {
      // Timeout estendido: fake-indexeddb é ~10× mais lento que IndexedDB nativo do browser.
      // Em produção, `anyOf(5000)` com índice nativo é sub-segundo.
      const TOTAL = 5_000
      const transactions: StructuredImportTransaction[] = Array.from({ length: TOTAL }, (_, i) => ({
        id: `row-${i}`,
        date: '2024-01-01',
        amount: i + 1,
        description: `Transacao carga ${i}`,
        direction: 'out' as Direction,
      }))

      await runImportPipeline({ file: makeFileInput('load-1', 'hash-load-1'), transactions })

      // Segunda importação com exatamente os mesmos dados (hash de arquivo diferente)
      const result2 = await runImportPipeline({ file: makeFileInput('load-2', 'hash-load-2'), transactions })

      expect(result2.newCount).toBe(0)
      expect(result2.duplicateCount).toBe(TOTAL)

      // O banco permanece com exatamente TOTAL registros — sem duplicatas
      expect(await db.transactions.count()).toBe(TOTAL)
    }, 20_000)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 4. DEDUPLICAÇÃO DETERMINÍSTICA — 10 importações do mesmo conteúdo
  // ─────────────────────────────────────────────────────────────────────────
  describe('Deduplicação determinística: 10 importações do mesmo conjunto', () => {
    it('mantém exatamente N transações únicas após N×10 importações sobrepostas', async () => {
      const UNIQUE_TX = 20
      const ROUNDS = 10

      // 20 transações com conteúdo único e determinístico
      const baseTransactions: StructuredImportTransaction[] = Array.from(
        { length: UNIQUE_TX },
        (_, i) => ({
          id: `row-${i}`,
          date: '2024-03-01',
          amount: (i + 1) * 10,
          description: `Transacao fixa ${i}`,
          direction: 'out' as Direction,
        }),
      )

      const results = []
      for (let round = 0; round < ROUNDS; round++) {
        const result = await runImportPipeline({
          file: makeFileInput(`round-file-${round}`, `unique-hash-${round}`),
          transactions: baseTransactions,
        })
        results.push(result)
      }

      // Rodada 0: todos são novos
      expect(results[0].newCount).toBe(UNIQUE_TX)
      expect(results[0].duplicateCount).toBe(0)

      // Rodadas 1–9: todos são duplicatas
      for (let round = 1; round < ROUNDS; round++) {
        expect(results[round].newCount).toBe(0)
        expect(results[round].duplicateCount).toBe(UNIQUE_TX)
      }

      // Estado final do banco: exatamente UNIQUE_TX registros, sem lixo
      const finalCount = await db.transactions.count()
      expect(finalCount).toBe(UNIQUE_TX)

      // Todos os fingerprints são únicos (sem colisão acidental)
      const allTx = await findAll()
      const fingerprints = new Set(allTx.map((t) => t.fingerprint))
      expect(fingerprints.size).toBe(UNIQUE_TX)
    })

    it('é idempotente: importar o mesmo arquivo 10 vezes (hashes diferentes) não altera o resultado', async () => {
      const transactions: StructuredImportTransaction[] = [
        makeTx({ amount: 777, description: 'Idempotente A' }),
        makeTx({ amount: 888, description: 'Idempotente B' }),
      ]

      // Simula o usuário importando arquivos "diferentes" (hashes diferentes)
      // com as mesmas transações internas — cenário real: extrato re-exportado com metadados distintos
      for (let i = 0; i < 10; i++) {
        await runImportPipeline({
          file: makeFileInput(`idem-file-${i}`, `idem-hash-${i}`),
          transactions,
        })
      }

      // Apenas 2 transações únicas, independente de quantas vezes foram importadas
      expect(await db.transactions.count()).toBe(2)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 5. RACE CONDITION — Guard de hash dentro da transação
  // ─────────────────────────────────────────────────────────────────────────
  describe('Race condition: importações concorrentes do mesmo arquivo', () => {
    it('garante que apenas uma importação vença quando duas ocorrem em paralelo', async () => {
      const file = makeFileInput('race-file', 'race-hash')
      const transactions = [makeTx({ amount: 42, description: 'Race condition tx' })]

      // Dispara duas importações do mesmo arquivo simultaneamente
      const [result1, result2] = await Promise.allSettled([
        runImportPipeline({ file, transactions }),
        runImportPipeline({ file, transactions }),
      ])

      // Uma deve ter sucesso
      const succeeded = [result1, result2].filter((r) => r.status === 'fulfilled')
      expect(succeeded).toHaveLength(1)

      // A outra deve falhar com o erro amigável de hash duplicado
      const failed = [result1, result2].filter((r) => r.status === 'rejected')
      expect(failed).toHaveLength(1)
      expect((failed[0] as PromiseRejectedResult).reason.message).toMatch(
        /já foi importado/,
      )

      // O banco deve conter exatamente 1 arquivo e 1 transação
      expect(await db.files.count()).toBe(1)
      expect(await db.transactions.count()).toBe(1)
    })
  })
})
