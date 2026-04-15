import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Transaction } from '../domain/types'
import { buildTransactionFingerprint } from '../domain/fingerprint'
import { db } from '../db/db'
import { addFile, getFileById } from '../db/repositories/files.repo'
import { transactionsRepo } from '../db/repositories/transactions.repo'
import { runImportPipeline } from './import.pipeline'

function makePersistedTransaction(overrides: Partial<Transaction> = {}): Transaction {
  // amountInUnits: 10000 = R$100,00 em centavos (amount '-100,00' no CSV → 100.00 float → 10000 units)
  // sourceRowId deve coincidir com o id do row-1 no arquivo de teste para que
  // a deduplicação detecte a transação como já existente no banco.
  const fp = buildTransactionFingerprint({
    amountInUnits: 10000,
    dateTs: Date.UTC(2024, 2, 15),
    direction: 'out',
    description: 'Pix enviado',
    sourceRowId: 'row-1',
  });
  return {
    id: fp,
    fileId: 'old-file',
    source: 'inter',
    date: '2024-03-15',
    dateTs: Date.UTC(2024, 2, 15),
    amountInUnits: 10000,
    currency: 'BRL',
    precision: 2,
    direction: 'out',
    description: 'Pix enviado',
    descriptionNormalized: 'pix enviado',
    sourceRowId: 'row-1',
    fingerprint: fp,
    possibleDuplicateKey: 'dup-1',
    ...overrides,
  }
}

describe('runImportPipeline', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.files.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persiste o arquivo e as transações, lidando com duplicatas via banco', async () => {
    // 1. Simula um arquivo já importado anteriormente
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

    // Adiciona uma transação que será duplicada no novo arquivo
    await db.transactions.add(makePersistedTransaction())

    // 2. Executa o pipeline com um novo arquivo que contém 1 nova e 2 duplicadas
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
          id: 'row-1', // Mesmos dados da persisted-1 (será ignorada/sobrescrita pelo bulkPut)
          date: '2024-03-15',
          amount: '-100,00',
          description: 'Pix enviado',
          counterparty: 'João Silva',
        },
        {
          id: 'row-2', // Transação nova
          date: '2024-03-20',
          amount: '-250,00',
          description: 'Transferência entre contas',
          counterparty: 'Conta própria',
        },
      ],
    })

    // 3. Validações do Retorno
    expect(result.fileId).toBe('file-1')
    expect(result.totalCount).toBe(2)
    expect(result.newCount).toBe(1)
    expect(result.duplicateCount).toBe(1)

    // 4. Validação de Persistência (O que realmente importa)
    const fileNoBanco = await getFileById('file-1')
    expect(fileNoBanco).toBeDefined()
    expect(fileNoBanco?.hash).toBe('hash-1')

    const todasTransacoes = await transactionsRepo.findAll()
    // Tinha 1 no banco + 2 no arquivo (sendo 1 duplicada) = total de 2 transações únicas no final
    // Nota: O bulkPut usa o ID/Fingerprint. Se os IDs forem diferentes mas os dados iguais, 
    // a regra de negócio do fingerprint cuidará da unicidade.
    expect(todasTransacoes.length).toBe(2) 

    // 5. Validação da transação nova específica
    // amountInUnits: 25000 = R$250,00 em centavos ('-250,00' no CSV → 250.00 float → 25000 units)
    const novaTransacao = todasTransacoes.find(t => t.amountInUnits === 25000)
    expect(novaTransacao).toMatchObject({
      fileId: 'file-1',
      amountInUnits: 25000,
      currency: 'BRL',
      precision: 2,
      direction: 'out',
      ownTransfer: true,
    })
  })

  it('XSS Guard: descrição maliciosa é armazenada como texto puro e descriptionNormalized remove tags HTML', async () => {
    const XSS_DESC = '<script>alert("xss")</script>'

    await runImportPipeline({
      file: {
        id: 'xss-file',
        name: 'xss.csv',
        sourceType: 'inter',
        hash: 'xss-hash',
        uploadedAt: new Date().toISOString(),
      },
      transactions: [
        { id: 'row-1', date: '2024-03-15', amount: '50,00', description: XSS_DESC, direction: 'out' },
      ],
    })

    const [tx] = await db.transactions.toArray()

    // description raw preservada como texto puro no banco (sem execução possível via IndexedDB)
    expect(tx.description).toBe(XSS_DESC)

    // descriptionNormalized não contém caracteres HTML — normalizeDescription remove via [^a-z0-9\s]
    expect(tx.descriptionNormalized).not.toContain('<')
    expect(tx.descriptionNormalized).not.toContain('>')
    expect(tx.descriptionNormalized).not.toContain('"')
    // resultado esperado: 'script alert xss script' (tags e parênteses viram espaços, depois colapsados)
    expect(tx.descriptionNormalized).toBe('script alert xss script')

    // Invariante: id === fingerprint (content-addressed primary key)
    expect(tx.id).toBe(tx.fingerprint)

    // Invariante Money Pattern: amountInUnits é inteiro positivo em centavos
    expect(Number.isInteger(tx.amountInUnits)).toBe(true)
    expect(tx.amountInUnits).toBe(5000) // R$50,00 → 5000 centavos
  })

  it('Atomicidade: banco sem sujeira quando bulkAdd falha durante a transação', async () => {
    const spy = vi
      .spyOn(db.transactions, 'bulkAdd')
      .mockRejectedValueOnce(new Error('QuotaExceededError: storage quota exceeded'))

    await expect(
      runImportPipeline({
        file: {
          id: 'atomic-file',
          name: 'atomic.csv',
          sourceType: 'inter',
          hash: 'atomic-hash',
          uploadedAt: new Date().toISOString(),
        },
        transactions: [
          { id: 'row-1', date: '2024-01-01', amount: '100,00', description: 'Pagamento', direction: 'out' },
        ],
      }),
    ).rejects.toThrow('QuotaExceededError')

    // Nenhum arquivo deve ter sido persistido — rollback da transação Dexie inclui addFile
    expect(await db.files.count()).toBe(0)

    // Nenhuma transação deve ter sido persistida — estado limpo após falha
    expect(await db.transactions.count()).toBe(0)
  })

  it('Idempotência Cruzada: mesmo conteúdo com hash diferente → duplicatas bloqueadas por fingerprint', async () => {
    const transactions = [
      { id: 'row-1', date: '2024-03-15', amount: '-100,00', description: 'Pix enviado' },
      { id: 'row-2', date: '2024-03-20', amount: '250,00', description: 'Salario recebido', direction: 'in' as const },
    ]

    // Primeira importação — tudo novo
    const result1 = await runImportPipeline({
      file: { id: 'file-v1', name: 'extrato-v1.csv', sourceType: 'inter', hash: 'hash-v1', uploadedAt: new Date().toISOString() },
      transactions,
    })
    expect(result1.newCount).toBe(2)
    expect(result1.duplicateCount).toBe(0)

    // Segunda importação: mesmas transações (mesmo id de linha → mesmo fingerprint), hash diferente
    const result2 = await runImportPipeline({
      file: { id: 'file-v2', name: 'extrato-v2.csv', sourceType: 'inter', hash: 'hash-v2', uploadedAt: new Date().toISOString() },
      transactions,
    })
    expect(result2.newCount).toBe(0)
    expect(result2.duplicateCount).toBe(2)

    // Banco inalterado: exatamente 2 transações únicas
    expect(await db.transactions.count()).toBe(2)

    // Ambos os arquivos foram registrados (mesmo quando todas as transações são duplicatas)
    expect(await db.files.count()).toBe(2)
  })

  it('Race Condition: importações simultâneas do mesmo arquivo — apenas uma persiste', async () => {
    const file = {
      id: 'race-file',
      name: 'extrato.csv',
      sourceType: 'inter' as const,
      hash: 'race-hash',
      uploadedAt: new Date().toISOString(),
    }
    const transactions = [
      { id: 'row-1', date: '2024-06-01', amount: '-200,00', description: 'Aluguel' },
    ]

    // Dispara duas importações idênticas ao mesmo tempo
    const [r1, r2] = await Promise.allSettled([
      runImportPipeline({ file, transactions }),
      runImportPipeline({ file, transactions }),
    ])

    const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled')
    const rejected  = [r1, r2].filter((r) => r.status === 'rejected')

    // Exatamente uma deve ter sucesso e a outra deve falhar com erro amigável
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const error = (rejected[0] as PromiseRejectedResult).reason as Error
    expect(error.message).toContain('race-hash')
    expect(error.message).toContain('já foi importado')

    // DB íntegro: exatamente 1 arquivo e 1 transação únicos — sem corrupção
    expect(await db.files.count()).toBe(1)
    expect(await db.transactions.count()).toBe(1)
  })

  it('Valores Extremos: zero rejeita na normalização; R$1 bilhão persiste sem perda de precisão', async () => {
    // Zero deve ser rejeitado durante o map() de normalização (antes de tocar o banco)
    await expect(
      runImportPipeline({
        file: {
          id: 'zero-file',
          name: 'zero.csv',
          sourceType: 'inter',
          hash: 'zero-hash',
          uploadedAt: new Date().toISOString(),
        },
        transactions: [
          { id: 'row-1', date: '2024-01-01', amount: '0,00', description: 'Valor zero', direction: 'out' },
        ],
      }),
    ).rejects.toThrow('Transaction amount must be greater than zero')

    // Banco permanece limpo — o erro ocorreu antes de qualquer write Dexie
    expect(await db.files.count()).toBe(0)
    expect(await db.transactions.count()).toBe(0)

    // R$1.000.000.000,00 deve persistir sem drift de float (Money Pattern)
    await runImportPipeline({
      file: {
        id: 'billion-file',
        name: 'billion.csv',
        sourceType: 'inter',
        hash: 'billion-hash',
        uploadedAt: new Date().toISOString(),
      },
      transactions: [
        { id: 'row-1', date: '2024-01-01', amount: '1.000.000.000,00', description: 'Aporte bilionario', direction: 'in' },
      ],
    })

    const [tx] = await db.transactions.toArray()

    // Money Pattern: R$1.000.000.000,00 = 100.000.000.000 centavos — inteiro exato, sem drift
    expect(tx.amountInUnits).toBe(100_000_000_000)
    expect(Number.isInteger(tx.amountInUnits)).toBe(true)
    expect(tx.direction).toBe('in')
    expect(tx.currency).toBe('BRL')
    expect(tx.precision).toBe(2)

    // Invariante: id === fingerprint (content-addressed primary key)
    expect(tx.id).toBe(tx.fingerprint)
  })

  it('falha explicitamente quando o hash do arquivo já existe', async () => {
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
            description: 'Pagamento',
          },
        ],
      }),
    ).rejects.toThrow('O arquivo com hash "same-hash" já foi importado.')
  })
})