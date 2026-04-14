import { buildPossibleDuplicateKey, buildTransactionFingerprint } from '../domain/fingerprint';
import type {
  Direction,
  ImportDateFormat,
  ImportedFile,
  RawTransactionData,
  Transaction,
} from '../domain/types';
import { db } from '../db/db';
import { addFile, getFileByHash } from '../db/repositories/files.repo';
import { bulkAddTransactions, getExistingFingerprints } from '../db/repositories/transactions.repo';
import { normalizeDescription } from '../normalization/description';
import { detectOwnTransfer, normalizeCounterparty } from '../normalization/counterparty';
import { normalizeTransactionDate, type DateInput } from '../normalization/date';
import {
  normalizeAmountWithDirection,
  normalizeTransactionAmount,
  type MonetaryInput,
} from '../normalization/amount';

/**
 * Representação inicial de uma transação estruturada vinda de um parser (CSV/PDF)
 */
export type StructuredImportTransaction = {
  id: string;
  date: DateInput;
  amount: MonetaryInput;
  description: string;
  direction?: Direction;
  counterparty?: string;
  bankName?: string;
  category?: string;
  tags?: string[];
  raw?: RawTransactionData;
};

export type ImportPipelineInput = {
  file: Omit<ImportedFile, 'rowCount' | 'validRowCount' | 'ignoredRowCount'>;
  transactions: StructuredImportTransaction[];
  options?: {
    dateFormat?: ImportDateFormat;
    negativeMeansOutflow?: boolean;
  };
};

export type ImportResult = {
  fileId: string;
  /** Total de linhas no arquivo de entrada */
  totalCount: number;
  /** Transações genuinamente novas inseridas no banco */
  newCount: number;
  /** Transações bloqueadas por já existirem (mesmo fingerprint) */
  duplicateCount: number;
};

/**
 * O Maestro: Coordena o fluxo desde a entrada bruta até ao salvamento no banco.
 *
 * Garantias:
 *   - Atômica: ou tudo persiste, ou nada (rollback automático pelo Dexie).
 *   - Sem race condition: o guard de hash e a deduplicação ocorrem dentro da
 *     mesma transação IDB, tornando-os serializados por construção.
 *   - Sem ConstraintError: apenas transações com fingerprint inédito chegam ao bulkAdd.
 */
export async function runImportPipeline(input: ImportPipelineInput): Promise<ImportResult> {
  // 1. Normalização (CPU puro — sem I/O de banco)
  const normalizedTransactions = input.transactions.map((t) =>
    normalizeImportTransaction(t, input.file.id, input.file.sourceType, input.options),
  );

  // 2. Persistência atômica: todo I/O de banco ocorre dentro desta transação Dexie
  return db.transaction('rw', [db.files, db.transactions], async () => {
    // 2a. Guard de hash dentro da tx — elimina a race condition de importações concorrentes
    const existingFile = await getFileByHash(input.file.hash);
    if (existingFile) {
      throw new Error(`O arquivo com hash "${input.file.hash}" já foi importado.`);
    }

    // 2b. Deduplicação com leitura consistente dentro da mesma transação IDB
    const { acceptedTransactions, blockedTransactions } =
      await deduplicateTransactions(normalizedTransactions);

    // 2c. Persiste o arquivo com contagens reais pós-deduplicação
    const file: ImportedFile = {
      ...input.file,
      rowCount: input.transactions.length,
      validRowCount: acceptedTransactions.length,
      ignoredRowCount: blockedTransactions.length,
    };
    await addFile(file);

    // 2d. Persiste apenas as transações genuinamente novas — sem risco de ConstraintError
    await bulkAddTransactions(acceptedTransactions);

    return {
      fileId: file.id,
      totalCount: file.rowCount,
      newCount: acceptedTransactions.length,
      duplicateCount: blockedTransactions.length,
    };
  });
}

/**
 * Converte e padroniza os campos de uma transação bruta em domínio.
 *
 * Invariante chave: `id` é definido como o fingerprint.
 * Isso garante que o primary key do IndexedDB seja globalmente único por conteúdo,
 * eliminando colisões de ID entre arquivos distintos e tornando o bulkAdd seguro.
 */
function normalizeImportTransaction(
  transaction: StructuredImportTransaction,
  fileId: string,
  source: ImportedFile['sourceType'],
  options?: ImportPipelineInput['options'],
): Transaction {
  const normalizedDate = normalizeTransactionDate(transaction.date, options?.dateFormat);
  const normalizedAmount = transaction.direction
    ? normalizeAmountWithDirection(transaction.amount, transaction.direction)
    : normalizeTransactionAmount(transaction.amount, options?.negativeMeansOutflow);

  const counterpartyNormalized = normalizeCounterparty(transaction.counterparty);
  const ownTransfer = detectOwnTransfer({
    description: transaction.description,
    counterparty: transaction.counterparty,
  });

  // sourceRowId = ID da linha fornecido pelo parser (ex: 'row-0', 'row-1').
  // Incluído no fingerprint para que duas transações idênticas em linhas distintas
  // do mesmo arquivo (ex: dois cafés de R$5,00 no mesmo dia) sejam tratadas
  // como registros independentes e preservem o saldo real do extrato.
  const sourceRowId = transaction.id;

  // Money Pattern: converte o float normalizado para unidade mínima da moeda (centavos).
  // Math.round elimina o drift binário: 0.1 + 0.2 = 0.30000...004 → round → 30 centavos exatos.
  const currency = 'BRL';
  const precision = 2;
  const amountInUnits = Math.round(normalizedAmount.amount * 10 ** precision);

  const fingerprintInput = {
    dateTs: normalizedDate.dateTs,
    amountInUnits,
    direction: normalizedAmount.direction,
    description: transaction.description,
    sourceRowId,
  };
  const fingerprint = buildTransactionFingerprint(fingerprintInput);

  return {
    id: fingerprint,
    fileId,
    source,
    date: normalizedDate.date,
    dateTs: normalizedDate.dateTs,
    amountInUnits,
    currency,
    precision,
    direction: normalizedAmount.direction,
    description: transaction.description,
    descriptionNormalized: normalizeDescription(transaction.description),
    sourceRowId,
    counterparty: transaction.counterparty,
    counterpartyNormalized,
    bankName: transaction.bankName,
    ownTransfer,
    category: transaction.category,
    tags: transaction.tags,
    fingerprint,
    possibleDuplicateKey: buildPossibleDuplicateKey(fingerprintInput),
    raw: transaction.raw,
  };
}

type DeduplicationResult = {
  acceptedTransactions: Transaction[];
  blockedTransactions: Transaction[];
};

/**
 * Separa transações novas das duplicadas, consultando o banco e o próprio lote.
 * Deve ser chamada DENTRO de um db.transaction para garantir leitura consistente.
 */
async function deduplicateTransactions(transactions: Transaction[]): Promise<DeduplicationResult> {
  const persistedFingerprints = new Set(
    await getExistingFingerprints(transactions.map((t) => t.fingerprint)),
  );
  const batchFingerprints = new Set<string>();
  const acceptedTransactions: Transaction[] = [];
  const blockedTransactions: Transaction[] = [];

  for (const transaction of transactions) {
    if (
      persistedFingerprints.has(transaction.fingerprint) ||
      batchFingerprints.has(transaction.fingerprint)
    ) {
      blockedTransactions.push(transaction);
    } else {
      batchFingerprints.add(transaction.fingerprint);
      acceptedTransactions.push(transaction);
    }
  }

  return { acceptedTransactions, blockedTransactions };
}
