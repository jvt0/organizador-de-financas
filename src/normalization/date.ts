import { normalizeDateToUtcDayTimestamp } from '../domain/fingerprint';
import type { ImportDateFormat } from '../domain/types';

export type DateInput = string | number | Date;

export type NormalizedDate = {
  date: string;
  dateTs: number;
};

export function normalizeTransactionDate(
  value: DateInput,
  dateFormat?: ImportDateFormat,
): NormalizedDate {
  if (value instanceof Date || typeof value === 'number') {
    return normalizeFromDateInstance(new Date(value));
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error('Date string cannot be empty.');
  }

  if (dateFormat) {
    const parsedParts = parseDateByFormat(trimmedValue, dateFormat);
    return buildNormalizedDate(parsedParts.year, parsedParts.month, parsedParts.day);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    const [year, month, day] = trimmedValue.split('-').map(Number);
    return buildNormalizedDate(year, month, day);
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmedValue)) {
    return normalizeFromDateInstance(new Date(trimmedValue));
  }

  throw new Error('Ambiguous date string. Provide an explicit dateFormat.');
}

function normalizeFromDateInstance(value: Date): NormalizedDate {
  if (Number.isNaN(value.getTime())) {
    throw new Error('Invalid date.');
  }

  return buildNormalizedDate(
    value.getUTCFullYear(),
    value.getUTCMonth() + 1,
    value.getUTCDate(),
  );
}

function parseDateByFormat(
  value: string,
  format: ImportDateFormat,
): { year: number; month: number; day: number } {
  const parts = value.match(/^(\d{2,4})[/-](\d{2})[/-](\d{2,4})$/);

  if (!parts) {
    throw new Error(`Date "${value}" does not match format "${format}".`);
  }

  const [, firstPart, secondPart, thirdPart] = parts;

  switch (format) {
    case 'dd/MM/yyyy':
      return {
        day: Number(firstPart),
        month: Number(secondPart),
        year: Number(thirdPart),
      };
    case 'MM/dd/yyyy':
      return {
        month: Number(firstPart),
        day: Number(secondPart),
        year: Number(thirdPart),
      };
    case 'yyyy-MM-dd':
      return {
        year: Number(firstPart),
        month: Number(secondPart),
        day: Number(thirdPart),
      };
    default:
      throw new Error(`Unsupported date format "${format}".`);
  }
}

function buildNormalizedDate(year: number, month: number, day: number): NormalizedDate {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error('Date parts must be integers.');
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${year}-${month}-${day}.`);
  }

  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dateTs = normalizeDateToUtcDayTimestamp(candidate.getTime());

  return { date, dateTs };
}
