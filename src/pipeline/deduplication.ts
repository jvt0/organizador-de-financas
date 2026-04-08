import type { Transaction } from '../domain/types';
import { getExistingFingerprints } from '../db/repositories/transactions.repo';

export type DeduplicationCandidate = Pick<Transaction, 'id' | 'fingerprint'> & Transaction;

export type DeduplicationResult = {
  acceptedTransactions: DeduplicationCandidate[];
  blockedTransactions: DeduplicationCandidate[];
};

export async function filterExactDuplicates(
  transactions: DeduplicationCandidate[],
): Promise<DeduplicationResult> {
  const persistedFingerprints = new Set(
    await getExistingFingerprints(transactions.map((transaction) => transaction.fingerprint)),
  );
  const batchFingerprints = new Set<string>();
  const acceptedTransactions: DeduplicationCandidate[] = [];
  const blockedTransactions: DeduplicationCandidate[] = [];

  for (const transaction of transactions) {
    if (
      persistedFingerprints.has(transaction.fingerprint) ||
      batchFingerprints.has(transaction.fingerprint)
    ) {
      blockedTransactions.push(transaction);
      continue;
    }

    batchFingerprints.add(transaction.fingerprint);
    acceptedTransactions.push(transaction);
  }

  return {
    acceptedTransactions,
    blockedTransactions,
  };
}
