import type { Transaction } from '../../domain/types';
import { db } from '../db';

export async function bulkAddTransactions(transactions: Transaction[]): Promise<void> {
  await db.transactions.bulkAdd(transactions);
}

export async function getExistingFingerprints(fingerprints: string[]): Promise<string[]> {
  if (fingerprints.length === 0) return [];
  const found = await db.transactions.where('fingerprint').anyOf(fingerprints).toArray();
  return found.map((t) => t.fingerprint);
}

export async function getTransactionsByFileId(fileId: string): Promise<Transaction[]> {
  return db.transactions.where('fileId').equals(fileId).sortBy('dateTs');
}

export async function deleteTransactionsByFileId(fileId: string): Promise<void> {
  await db.transactions.where('fileId').equals(fileId).delete();
}

export async function findAll(): Promise<Transaction[]> {
  return db.transactions.orderBy('dateTs').reverse().toArray();
}

export async function clearAll(): Promise<void> {
  await db.transactions.clear();
  await db.files.clear();
}

// Objeto para compatibilidade com consumidores que usam transactionsRepo.findAll()
export const transactionsRepo = { findAll, clearAll };
