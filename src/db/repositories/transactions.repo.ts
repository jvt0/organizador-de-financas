import type { Transaction } from '../../domain/types';
import { db } from '../db';

export async function bulkAddTransactions(transactions: Transaction[]): Promise<string[]> {
  return db.transactions.bulkAdd(transactions, { allKeys: true });
}

export async function getExistingFingerprints(fingerprints: string[]): Promise<string[]> {
  if (fingerprints.length === 0) {
    return [];
  }

  const existingTransactions = await db.transactions.where('fingerprint').anyOf(fingerprints).toArray();

  return existingTransactions.map((transaction) => transaction.fingerprint);
}

export async function deleteTransactionsByFileId(fileId: string): Promise<number> {
  return db.transactions.where('fileId').equals(fileId).delete();
}

export async function getTransactionsByFileId(fileId: string): Promise<Transaction[]> {
  return db.transactions.where('fileId').equals(fileId).sortBy('dateTs');
}
