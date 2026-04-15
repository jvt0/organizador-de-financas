/**
 * Stress Tests — Pipeline de Importação
 *
 * Valida comportamento em cenários adversos: falhas atômicas, colisões de fingerprint,
 * carga de dados e determinismo de deduplicação.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Direction } from '../domain/types'
import { db } from '../db/db'
import { deleteFile, getFileByHash } from '../db/repositories/files.repo'
import { findAll } from '../db/repositories/transactions.repo'
import { toDisplay } from '../utils/money'
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

  afterEach(() => {
    vi.restoreAllMocks()
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
    it('deduplicação cross-banco exige mesmo sourceRowId além do mesmo conteúdo', async () => {
      // Com o novo fingerprint (Conteúdo + sourceRowId), dois arquivos de bancos diferentes
      // com MESMO conteúdo mas DIFERENTES IDs de linha geram registros distintos.
      // Isso é correto: não podemos saber se são a mesma transação ou coincidência.
      //
      // A deduplicação cross-arquivo apenas funciona quando sourceRowId também coincide
      // (ex: re-exportação do mesmo extrato com header diferente).
      const sharedTx: StructuredImportTransaction = {
        id: 'row-1',
        date: '2024-06-01',
        amount: 1500,
        description: 'Salario',
        direction: 'in',
      }

      // 1ª importação: Inter, row-1
      await runImportPipeline({
        file: makeFileInput('file-inter', 'hash-inter'),
        transactions: [sharedTx],
      })

      // 2ª importação: Nubank, mesmo conteúdo mas row-A (sourceRowId diferente) → NÃO é duplicata
      const resultNubank = await runImportPipeline({
        file: { ...makeFileInput('file-nubank', 'hash-nubank'), sourceType: 'nubank' },
        transactions: [{ ...sharedTx, id: 'row-A' }],
      })

      expect(resultNubank.newCount).toBe(1)
      expect(resultNubank.duplicateCount).toBe(0)
      expect(await db.transactions.count()).toBe(2)

      // Prova do inverso: mesmo sourceRowId → É deduplicado corretamente
      const resultNubankSameRow = await runImportPipeline({
        file: { ...makeFileInput('file-nubank-2', 'hash-nubank-2'), sourceType: 'nubank' },
        transactions: [{ ...sharedTx, id: 'row-1' }], // mesmo sourceRowId do Inter
      })

      expect(resultNubankSameRow.duplicateCount).toBe(1)
      expect(await db.transactions.count()).toBe(2) // banco inalterado
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

    it('linhas com IDs distintos e mesmo conteúdo são registros legítimos (dois cafés)', async () => {
      // Cenário: duas compras idênticas no mesmo arquivo (ex: dois cafés R$5,00 no mesmo dia).
      // IDs de linha diferentes (row-1 ≠ row-2) → fingerprints diferentes → ambas aceitas.
      const result = await runImportPipeline({
        file: makeFileInput('file-dois-cafes', 'hash-dois-cafes'),
        transactions: [
          makeTx({ id: 'row-1', amount: 5, description: 'Cafe' }),
          makeTx({ id: 'row-2', amount: 5, description: 'Cafe' }),
        ],
      })

      // Ambas são transações legítimas — nenhuma é duplicata da outra
      expect(result.newCount).toBe(2)
      expect(result.duplicateCount).toBe(0)
      expect(await db.transactions.count()).toBe(2)
    })

    it('trata colisão de fingerprint real: mesma linha (mesmo id) no mesmo lote', async () => {
      // Duplicata real: mesma linha enviada duas vezes no mesmo lote (bug do parser)
      // Mesmo id → mesmo fingerprint → segunda bloqueada
      const sameTx = makeTx({ id: 'row-1', amount: 99, description: 'Duplicata parser bug' })

      const result = await runImportPipeline({
        file: makeFileInput('file-intrabatch', 'hash-intrabatch'),
        transactions: [sameTx, { ...sameTx }], // mesmo id, mesmo conteúdo
      })

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

  // ─────────────────────────────────────────────────────────────────────────
  // 6. INTEGRIDADE FINANCEIRA — Transações idênticas no mesmo extrato
  // ─────────────────────────────────────────────────────────────────────────
  describe('Integridade financeira: transações idênticas no mesmo arquivo', () => {
    it('preserva 3 compras de R$10,00 como 3 registros distintos e soma R$30,00', async () => {
      // Cenário real: três cafés comprados no mesmo dia, mesmo valor, mesmo estabelecimento.
      // Com fingerprint incluindo sourceRowId, cada linha é um registro independente.
      const result = await runImportPipeline({
        file: makeFileInput('cafe-file', 'cafe-hash'),
        transactions: [
          makeTx({ id: 'row-0', amount: 10, description: 'Cafezinho padaria' }),
          makeTx({ id: 'row-1', amount: 10, description: 'Cafezinho padaria' }),
          makeTx({ id: 'row-2', amount: 10, description: 'Cafezinho padaria' }),
        ],
      })

      // Os 3 devem ter sido aceitos — nenhum é duplicata do outro
      expect(result.totalCount).toBe(3)
      expect(result.newCount).toBe(3)
      expect(result.duplicateCount).toBe(0)

      // Exatamente 3 registros no banco
      const transacoes = await findAll()
      expect(transacoes).toHaveLength(3)

      // Soma financeira correta: 3 × R$10,00 = 3000 centavos (Money Pattern — sem drift float)
      const soma = transacoes.reduce((acc, t) => acc + t.amountInUnits, 0)
      expect(soma).toBe(3000)

      // Todos com descriptionNormalized preenchido (mandatório para a engine de insights)
      for (const t of transacoes) {
        expect(t.descriptionNormalized).toBe('cafezinho padaria')
        expect(t.sourceRowId).toMatch(/^row-[012]$/)
      }
    })

    it('re-importar o mesmo arquivo não duplica os registros (idempotência via hash guard)', async () => {
      const transactions = [
        makeTx({ id: 'row-0', amount: 10, description: 'Cafezinho padaria' }),
        makeTx({ id: 'row-1', amount: 10, description: 'Cafezinho padaria' }),
        makeTx({ id: 'row-2', amount: 10, description: 'Cafezinho padaria' }),
      ]

      // 1ª importação
      await runImportPipeline({ file: makeFileInput('cafe-idem', 'cafe-idem-hash'), transactions })
      expect(await db.transactions.count()).toBe(3)

      // 2ª tentativa do mesmo arquivo → bloqueada pelo hash guard
      await expect(
        runImportPipeline({ file: makeFileInput('cafe-idem-2', 'cafe-idem-hash'), transactions }),
      ).rejects.toThrow('já foi importado')

      // Banco intocado: ainda 3 registros, soma ainda 3000 centavos (R$30,00)
      const transacoesFinais = await findAll()
      expect(transacoesFinais).toHaveLength(3)
      const somaFinal = transacoesFinais.reduce((acc, t) => acc + t.amountInUnits, 0)
      expect(somaFinal).toBe(3000)
    })

    it('valida descriptionNormalized para clustering: estabelecimentos com códigos variáveis', async () => {
      // "PADARIA ALFA 123" e "Padaria Alfa 456" devem ter o mesmo descriptionNormalized
      await runImportPipeline({
        file: makeFileInput('cluster-file', 'cluster-hash'),
        transactions: [
          makeTx({ id: 'row-0', amount: 15, description: 'PADARIA ALFA 123' }),
          makeTx({ id: 'row-1', amount: 15, description: 'Padaria Alfa 456' }),
          makeTx({ id: 'row-2', amount: 15, description: 'PIX-987654 Mercado Central' }),
        ],
      })

      const transacoes = await findAll()

      const [t0, t1, t2] = [
        transacoes.find(t => t.sourceRowId === 'row-0'),
        transacoes.find(t => t.sourceRowId === 'row-1'),
        transacoes.find(t => t.sourceRowId === 'row-2'),
      ]

      // Mesma padaria, códigos diferentes → mesmo cluster key
      expect(t0?.descriptionNormalized).toBe('padaria alfa')
      expect(t1?.descriptionNormalized).toBe('padaria alfa')
      expect(t0?.descriptionNormalized).toBe(t1?.descriptionNormalized)

      // PIX code removido, nome do estabelecimento preservado
      expect(t2?.descriptionNormalized).toBe('pix mercado central')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 7. PRECISÃO DECIMAL — Money Pattern vs. float
  // ─────────────────────────────────────────────────────────────────────────
  describe('Precisão decimal: Money Pattern elimina drift binário', () => {
    it('1000 transações de R$0,10 somam exatamente R$100,00 (sem drift)', async () => {
      // Prova do problema: em JS puro, 0.1 + 0.1 + ... 1000x pode não ser exatamente 100.0
      // Com Money Pattern (amountInUnits inteiro), a soma de inteiros é sempre exata.
      const TOTAL = 1_000
      const transactions: StructuredImportTransaction[] = Array.from({ length: TOTAL }, (_, i) => ({
        id: `row-${i}`,
        date: '2024-01-01',
        amount: '0.10', // CSV string: R$0,10
        description: `Micro pagamento ${i}`,
        direction: 'out' as Direction,
      }))

      const result = await runImportPipeline({
        file: makeFileInput('precision-file', 'precision-hash'),
        transactions,
      })

      expect(result.totalCount).toBe(TOTAL)
      expect(result.newCount).toBe(TOTAL)

      const all = await findAll()
      expect(all).toHaveLength(TOTAL)

      // Cada transação deve ter amountInUnits = 10 (R$0,10 = 10 centavos)
      const allAre10Cents = all.every(t => t.amountInUnits === 10)
      expect(allAre10Cents).toBe(true)

      // Soma de inteiros: 1000 × 10 = 10000 centavos — exata, sem drift
      const somaUnits = all.reduce((acc, t) => acc + t.amountInUnits, 0)
      expect(somaUnits).toBe(10_000)

      // Conversão para display: 10000 centavos = R$100,00 — exato
      expect(toDisplay(somaUnits)).toBe('100.00')

      // Prova do problema que o Money Pattern resolve:
      // Se usássemos floats: soma de 1000 × 0.1 em JS pode não ser exatamente 100
      const somaFloat = Array.from({ length: TOTAL }, () => 0.1).reduce((a, b) => a + b, 0)
      // somaFloat pode ser 99.9999...98 ou 100.00000...01 dependendo do engine
      // Com amountInUnits: SEMPRE 10000, SEMPRE correto
      expect(somaUnits).toBe(10_000) // garantia absoluta
    }, 15_000)

    it('valores com drift binário famoso: 0.1 + 0.2 armazenados como 30 centavos exatos', async () => {
      // 0.1 + 0.2 === 0.30000000000000004 em JS — Math.round(0.30000000000000004 * 100) = 30 ✓
      await runImportPipeline({
        file: makeFileInput('drift-file', 'drift-hash'),
        transactions: [
          { id: 'row-0', date: '2024-01-01', amount: 0.1, description: 'Dez centavos', direction: 'out' },
          { id: 'row-1', date: '2024-01-01', amount: 0.2, description: 'Vinte centavos', direction: 'out' },
        ],
      })

      const all = await findAll()
      const soma = all.reduce((acc, t) => acc + t.amountInUnits, 0)

      // 10 + 20 = 30 centavos — sem drift de ponto flutuante
      expect(soma).toBe(30)
      expect(toDisplay(soma)).toBe('0.30')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 8. SEGURANÇA — XSS Guard e Exclusão em Cascata
  // ─────────────────────────────────────────────────────────────────────────
  describe('Segurança: XSS Guard e exclusão em cascata', () => {
    it('XSS Guard: descrição maliciosa é armazenada como texto puro e descriptionNormalized remove tags HTML', async () => {
      const XSS_DESC = '<script>alert(1)</script>'

      await runImportPipeline({
        file: makeFileInput('xss-file', 'xss-hash'),
        transactions: [makeTx({ id: 'row-xss', description: XSS_DESC })],
      })

      const [tx] = await findAll()

      // description raw preservada — não é executada por ser string inerte no IndexedDB
      expect(tx.description).toBe(XSS_DESC)

      // descriptionNormalized não contém caracteres HTML — normalizeDescription limpa via [^a-z0-9\s]
      expect(tx.descriptionNormalized).not.toContain('<')
      expect(tx.descriptionNormalized).not.toContain('>')
      expect(tx.descriptionNormalized).not.toContain('(')
      // '/' vira espaço na etapa de separadores; '<', '>', '(' e ')' viram espaços em [^a-z0-9\s]
      expect(tx.descriptionNormalized).toBe('script alert 1 script')

      // Invariante: id === fingerprint — preservado mesmo com descrição adversária
      expect(tx.id).toBe(tx.fingerprint)

      // Invariante Money Pattern: amountInUnits permanece inteiro positivo
      expect(Number.isInteger(tx.amountInUnits)).toBe(true)
      expect(tx.amountInUnits).toBeGreaterThan(0)
    })

    it('Integridade de Exclusão: deleteFile remove arquivo e todas as transações atomicamente', async () => {
      // 1. Importa arquivo com 3 transações
      const result = await runImportPipeline({
        file: makeFileInput('delete-target', 'delete-hash'),
        transactions: [
          makeTx({ id: 'row-1', amount: 100, description: 'Pagamento A' }),
          makeTx({ id: 'row-2', amount: 200, description: 'Pagamento B' }),
          makeTx({ id: 'row-3', amount: 300, description: 'Pagamento C' }),
        ],
      })

      // Estado pós-importação: 1 arquivo e 3 transações no banco
      expect(result.newCount).toBe(3)
      expect(await db.files.count()).toBe(1)
      expect(await db.transactions.count()).toBe(3)

      // 2. Exclusão em cascata via deleteFile (único caminho correto, conforme CLAUDE.md)
      await deleteFile('delete-target')

      // 3. Banco zerado — arquivo e transações removidos em transação atômica única
      expect(await db.files.count()).toBe(0)
      expect(await db.transactions.count()).toBe(0)
    })

    it('Exclusão Parcial: deleteFile de um arquivo não afeta transações de outro arquivo', async () => {
      // Importa dois arquivos distintos
      await runImportPipeline({
        file: makeFileInput('file-a', 'hash-a'),
        transactions: [makeTx({ id: 'row-1', amount: 50, description: 'Tx do arquivo A' })],
      })
      await runImportPipeline({
        file: makeFileInput('file-b', 'hash-b'),
        transactions: [makeTx({ id: 'row-1', amount: 75, description: 'Tx do arquivo B' })],
      })

      expect(await db.transactions.count()).toBe(2)

      // Deleta apenas o arquivo A
      await deleteFile('file-a')

      // Arquivo A e sua transação foram removidos
      expect(await db.files.count()).toBe(1)
      expect(await db.transactions.count()).toBe(1)

      // A transação sobrevivente pertence ao arquivo B
      const [remaining] = await findAll()
      expect(remaining.fileId).toBe('file-b')
      expect(remaining.amountInUnits).toBe(7500) // R$75,00 = 7500 centavos
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 9. UNICODE & EMOJI — Integridade de dados end-to-end
  // ─────────────────────────────────────────────────────────────────────────
  describe('Unicode e Emoji: integridade de dados end-to-end', () => {
    it('description com unicode (japonês, árabe) é preservada exatamente no banco', async () => {
      const UNICODE_DESC = 'Transferência 高木ゆうこ → محمد علي'

      await runImportPipeline({
        file: makeFileInput('unicode-file', 'unicode-hash'),
        transactions: [makeTx({ id: 'row-uni', description: UNICODE_DESC })],
      })

      const [tx] = await findAll()

      // description raw: preservada byte a byte no IndexedDB
      expect(tx.description).toBe(UNICODE_DESC)

      // descriptionNormalized: NFD + [^a-z0-9\s] remove chars não-ASCII
      // Apenas 'transferencia' (sem acento) e espaços sobrevivem
      expect(tx.descriptionNormalized).not.toContain('高木')
      expect(tx.descriptionNormalized).not.toContain('محمد')
      expect(tx.descriptionNormalized).toBe('transferencia')

      // Invariante: id === fingerprint preservado mesmo com unicode no payload
      expect(tx.id).toBe(tx.fingerprint)
    })

    it('description com emoji é preservada no banco e removida do descriptionNormalized', async () => {
      const EMOJI_DESC = '☕ Cafezinho na padaria 🥐'

      await runImportPipeline({
        file: makeFileInput('emoji-file', 'emoji-hash'),
        transactions: [makeTx({ id: 'row-emoji', description: EMOJI_DESC })],
      })

      const [tx] = await findAll()

      // raw preservada com emoji
      expect(tx.description).toBe(EMOJI_DESC)

      // descriptionNormalized: emoji removidos pela etapa de emoji do normalizeDescription
      expect(tx.descriptionNormalized).not.toContain('☕')
      expect(tx.descriptionNormalized).not.toContain('🥐')
      expect(tx.descriptionNormalized).toBe('cafezinho na padaria')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 10. FLOAT IEEE 754 — Limites de representação binária
  // ─────────────────────────────────────────────────────────────────────────
  describe('Float IEEE 754: Math.round elimina drift binário em amountInUnits', () => {
    it('R$0,01 (valor mínimo BRL) → 1 centavo exato, sem arredondamento errado', async () => {
      await runImportPipeline({
        file: makeFileInput('cent-file', 'cent-hash'),
        transactions: [makeTx({ id: 'row-1', amount: '0,01', direction: 'in' })],
      })
      const [tx] = await findAll()
      expect(tx.amountInUnits).toBe(1)
      expect(Number.isInteger(tx.amountInUnits)).toBe(true)
    })

    it('R$19,99 — drift clássico: 19.99 × 100 = 1998.9999...98 → Math.round → 1999', async () => {
      await runImportPipeline({
        file: makeFileInput('1999-file', '1999-hash'),
        transactions: [makeTx({ id: 'row-1', amount: '19,99', direction: 'out' })],
      })
      const [tx] = await findAll()
      expect(tx.amountInUnits).toBe(1999)
    })

    it('R$1,11 — drift binário: 1.11 × 100 = 111.00000000000001 → Math.round → 111', async () => {
      await runImportPipeline({
        file: makeFileInput('111-file', '111-hash'),
        transactions: [makeTx({ id: 'row-1', amount: '1,11', direction: 'in' })],
      })
      const [tx] = await findAll()
      expect(tx.amountInUnits).toBe(111)
    })

    it('R$2,22 — drift binário: 2.22 × 100 = 222.00000000000003 → Math.round → 222', async () => {
      await runImportPipeline({
        file: makeFileInput('222-file', '222-hash'),
        transactions: [makeTx({ id: 'row-1', amount: '2,22', direction: 'out' })],
      })
      const [tx] = await findAll()
      expect(tx.amountInUnits).toBe(222)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 11. RACE CONDITION AVANÇADA — deleteFile vs runImportPipeline simultâneos
  // ─────────────────────────────────────────────────────────────────────────
  describe('Race Condition avançada: deleteFile e runImportPipeline simultâneos', () => {
    it('banco termina em estado consistente quando delete e import do mesmo conteúdo correm em paralelo', async () => {
      // Setup: arquivo-a pré-importado com 3 transações
      const txs = [
        makeTx({ id: 'row-1', amount: 100, description: 'Tx Alpha' }),
        makeTx({ id: 'row-2', amount: 200, description: 'Tx Beta' }),
        makeTx({ id: 'row-3', amount: 300, description: 'Tx Gamma' }),
      ]
      await runImportPipeline({ file: makeFileInput('file-a', 'hash-a'), transactions: txs })
      expect(await db.transactions.count()).toBe(3)

      // Race: deletar file-a e importar file-b (mesmo conteúdo, hash diferente) simultaneamente
      await Promise.allSettled([
        deleteFile('file-a'),
        runImportPipeline({ file: makeFileInput('file-b', 'hash-b'), transactions: txs }),
      ])

      // Invariante: exatamente 1 arquivo no banco (file-b sempre ganha, file-a sempre some)
      expect(await db.files.count()).toBe(1)
      const [survivingFile] = await db.files.toArray()
      expect(survivingFile.id).toBe('file-b')

      // Invariante de consistência referencial: toda transação pertence ao arquivo sobrevivente
      const remainingTxs = await findAll()
      for (const tx of remainingTxs) {
        expect(tx.fileId).toBe('file-b')
      }

      // Contagem consistente: 0 (import bloqueou tudo por dupl.) ou 3 (delete venceu primeiro)
      expect([0, 3]).toContain(remainingTxs.length)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 12. ESCRITAS PARALELAS — Resistência a deadlock
  // ─────────────────────────────────────────────────────────────────────────
  describe('Escritas paralelas: 5 importações simultâneas sem deadlock', () => {
    it('5 arquivos distintos importados em paralelo — todas resolvem, banco consistente', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          runImportPipeline({
            file: makeFileInput(`parallel-${i}`, `parallel-hash-${i}`),
            transactions: [
              makeTx({ id: 'row-1', amount: (i + 1) * 100, description: `Pagamento paralelo ${i} A` }),
              makeTx({ id: 'row-2', amount: (i + 1) * 200, description: `Pagamento paralelo ${i} B` }),
            ],
          }),
        ),
      )

      // Todas as 5 importações devem ter resolvido com sucesso (sem deadlock)
      expect(results).toHaveLength(5)
      expect(results.every(r => r.newCount === 2)).toBe(true)
      expect(results.every(r => r.duplicateCount === 0)).toBe(true)

      // Estado final: 5 arquivos × 2 transações = 10 registros únicos
      expect(await db.files.count()).toBe(5)
      expect(await db.transactions.count()).toBe(10)
    })
  })
})
