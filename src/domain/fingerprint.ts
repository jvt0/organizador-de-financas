import type { Direction, Transaction } from './types';

type FingerprintInput = Pick<Transaction, 'amountInUnits' | 'dateTs' | 'description' | 'direction' | 'sourceRowId'>;

type PossibleDuplicateInput = Pick<Transaction, 'amountInUnits' | 'dateTs' | 'direction'>;

export function buildTransactionFingerprint(input: FingerprintInput): string {
  return hashFingerprintParts([
    String(normalizeDateToUtcDayTimestamp(input.dateTs)),
    normalizePositiveAmountUnits(input.amountInUnits),
    input.direction,
    normalizeFingerprintText(input.description),
    input.sourceRowId,
  ]);
}

export function buildPossibleDuplicateKey(input: PossibleDuplicateInput): string {
  return hashFingerprintParts([
    String(normalizeDateToUtcDayTimestamp(input.dateTs)),
    normalizePositiveAmountUnits(input.amountInUnits),
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

/**
 * Serializa amountInUnits (inteiro, ex: 1000 para R$10,00) para o hash.
 * Inteiros são representados diretamente como string — sem ponto flutuante.
 */
export function normalizePositiveAmountUnits(amountInUnits: number): string {
  if (!Number.isFinite(amountInUnits) || amountInUnits <= 0 || !Number.isInteger(amountInUnits)) {
    throw new Error(
      `amountInUnits must be a positive integer. Received: ${amountInUnits}. ` +
        'Use Math.round(amount * 10^precision) before fingerprinting.',
    );
  }

  return String(amountInUnits);
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
