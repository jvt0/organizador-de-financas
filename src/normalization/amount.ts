import type { Direction } from '../domain/types';

export type MonetaryInput = number | string;

export type NormalizedAmount = {
  amount: number;
  direction: Direction;
};

// Future: generic CSV import may pass explicit decimal separator/config.
export function parseMonetaryAmount(value: MonetaryInput): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Amount must be a finite number.');
    }

    return value;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error('Amount string cannot be empty.');
  }

  let normalizedValue = trimmedValue.replace(/\s+/g, '');
  let isNegative = false;

  if (/^\(.*\)$/.test(normalizedValue)) {
    isNegative = true;
    normalizedValue = normalizedValue.slice(1, -1);
  }

  if (normalizedValue.includes('-')) {
    isNegative = true;
  }

  normalizedValue = normalizedValue.replace(/[^\d.,]/g, '');

  if (!/\d/.test(normalizedValue)) {
    throw new Error('Amount string must contain digits.');
  }

  const numericValue = normalizeNumericString(normalizedValue);
  const parsedValue = Number(numericValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Invalid monetary amount: "${value}".`);
  }

  return isNegative ? -parsedValue : parsedValue;
}

export function normalizeTransactionAmount(
  value: MonetaryInput,
  negativeMeansOutflow = true,
): NormalizedAmount {
  const parsedAmount = parseMonetaryAmount(value);

  if (parsedAmount === 0) {
    throw new Error('Transaction amount must be greater than zero.');
  }

  const direction: Direction =
    parsedAmount < 0
      ? negativeMeansOutflow
        ? 'out'
        : 'in'
      : negativeMeansOutflow
        ? 'in'
        : 'out';

  return {
    amount: Math.abs(parsedAmount),
    direction,
  };
}

export function normalizeAmountWithDirection(
  value: MonetaryInput,
  direction: Direction,
): NormalizedAmount {
  const parsedAmount = parseMonetaryAmount(value);
  const normalizedAmount = Math.abs(parsedAmount);

  if (normalizedAmount === 0) {
    throw new Error('Transaction amount must be greater than zero.');
  }

  if (parsedAmount < 0 && direction === 'in') {
    throw new Error('Negative amount is inconsistent with direction "in".');
  }

  return {
    amount: normalizedAmount,
    direction,
  };
}

function normalizeNumericString(value: string): string {
  const hasComma = value.includes(',');
  const hasDot = value.includes('.');

  if (hasComma && hasDot) {
    const decimalSeparator = value.lastIndexOf(',') > value.lastIndexOf('.') ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';

    return value.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
  }

  if (hasComma) {
    return normalizeSingleSeparatorNumber(value, ',');
  }

  if (hasDot) {
    return normalizeSingleSeparatorNumber(value, '.');
  }

  return value;
}

function normalizeSingleSeparatorNumber(value: string, separator: ',' | '.'): string {
  const parts = value.split(separator);

  if (parts.length === 1) {
    return value;
  }

  if (parts.length > 2) {
    return parts.join('');
  }

  const [integerPart, fractionalOrGroupedPart] = parts;

  if (!fractionalOrGroupedPart) {
    throw new Error(`Invalid monetary amount: "${value}".`);
  }

  if (fractionalOrGroupedPart.length <= 2) {
    return `${integerPart}.${fractionalOrGroupedPart}`;
  }

  return `${integerPart}${fractionalOrGroupedPart}`;
}
