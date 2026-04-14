import { beforeEach, describe, expect, it } from 'vitest'

import type { Transaction } from '../domain/types'
import { buildTransactionFingerprint } from '../domain/fingerprint'
import { db } from '../db/db'
import { addFile, getFileById } from '../db/repositories/files.repo'
import { transactionsRepo } from '../db/repositories/transactions.repo' // Importação corrigida
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

    // 5. Validação da transação nova específica (id agora é o fingerprint, não o row-id do parser)
    const novaTransacao = todasTransacoes.find(t => t.amount === 250)
    expect(novaTransacao).toMatchObject({
      fileId: 'file-1',
      amount: 250,
      direction: 'out',
      ownTransfer: true,
    })
  })

  it('falha explicitamente quando o hash do arquivo ja existe', async () => {
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