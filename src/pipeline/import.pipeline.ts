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
import { bulkAddTransactions } from '../db/repositories/transactions.repo';
import { detectOwnTransfer, normalizeCounterparty } from '../normalization/counterparty';
import { normalizeTransactionDate, type DateInput } from '../normalization/date';
import {
  normalizeAmountWithDirection,
  normalizeTransactionAmount,
  type MonetaryInput,
} from '../normalization/amount';
import { filterExactDuplicates } from './deduplication';

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
  file: ImportedFile;
  acceptedTransactions: Transaction[];
  blockedTransactions: Transaction[];
  totalCount: number;
  acceptedCount: number;
  duplicateCount: number;
};

export async function runImportPipeline(input: ImportPipelineInput): Promise<ImportResult> {
  const existingFile = await getFileByHash(input.file.hash);

  if (existingFile) {
    throw new Error(`Imported file with hash "${input.file.hash}" already exists.`);
  }

  const normalizedTransactions = input.transactions.map((transaction) =>
    normalizeImportTransaction(transaction, input.file.id, input.file.sourceType, input.options),
  );
  const deduplicationResult = await filterExactDuplicates(normalizedTransactions);

  const file: ImportedFile = {
    ...input.file,
    rowCount: input.transactions.length,
    validRowCount: deduplicationResult.acceptedTransactions.length,
    ignoredRowCount: deduplicationResult.blockedTransactions.length,
  };

  await db.transaction('rw', db.files, db.transactions, async () => {
    await addFile(file);

    if (deduplicationResult.acceptedTransactions.length > 0) {
      await bulkAddTransactions(deduplicationResult.acceptedTransactions);
    }
  });

  return {
    file,
    acceptedTransactions: deduplicationResult.acceptedTransactions,
    blockedTransactions: deduplicationResult.blockedTransactions,
    totalCount: input.transactions.length,
    acceptedCount: deduplicationResult.acceptedTransactions.length,
    duplicateCount: deduplicationResult.blockedTransactions.length,
  };
}

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

  const normalizedTransaction: Transaction = {
    id: transaction.id,
    fileId,
    source,
    date: normalizedDate.date,
    dateTs: normalizedDate.dateTs,
    amount: normalizedAmount.amount,
    direction: normalizedAmount.direction,
    description: transaction.description,
    counterparty: transaction.counterparty,
    counterpartyNormalized,
    bankName: transaction.bankName,
    ownTransfer,
    category: transaction.category,
    tags: transaction.tags,
    fingerprint: '',
    possibleDuplicateKey: undefined,
    raw: transaction.raw,
  };

  normalizedTransaction.fingerprint = buildTransactionFingerprint(normalizedTransaction);
  normalizedTransaction.possibleDuplicateKey = buildPossibleDuplicateKey(normalizedTransaction);

  return normalizedTransaction;
}
