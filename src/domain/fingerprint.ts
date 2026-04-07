import { FINGERPRINT_AMOUNT_PRECISION } from './constants';
import type { Direction, Transaction } from './types';

type FingerprintInput = Pick<Transaction, 'amount' | 'dateTs' | 'description' | 'direction'>;

type PossibleDuplicateInput = Pick<Transaction, 'amount' | 'dateTs' | 'direction'>;

export function buildTransactionFingerprint(input: FingerprintInput): string {
  return hashFingerprintParts([
    String(normalizeDateToUtcDayTimestamp(input.dateTs)),
    normalizePositiveAmount(input.amount),
    input.direction,
    normalizeFingerprintText(input.description),
  ]);
}

export function buildPossibleDuplicateKey(input: PossibleDuplicateInput): string {
  return hashFingerprintParts([
    String(normalizeDateToUtcDayTimestamp(input.dateTs)),
    normalizePositiveAmount(input.amount),
    input.direction,
  ]);
}

export function normalizeDateToUtcDayTimestamp(dateTs: number): number {
  const date = new Date(dateTs);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function normalizeFingerprintText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePositiveAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Transaction amount must be a finite positive number.');
  }

  return amount.toFixed(FINGERPRINT_AMOUNT_PRECISION);
}

export function isValidDirection(direction: string): direction is Direction {
  return direction === 'in' || direction === 'out';
}

function hashFingerprintParts(parts: string[]): string {
  const serialized = parts.join('|');
  let hash = 0x811c9dc5;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fp_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
