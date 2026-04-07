import { normalizeFingerprintText } from '../domain/fingerprint';
import {
  COUNTERPARTY_STOP_TERMS,
  OWN_TRANSFER_STRONG_TERMS,
} from '../domain/constants';

export type OwnTransferDetectionInput = {
  description?: string;
  counterparty?: string;
};

export function normalizeCounterparty(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  let normalizedValue = normalizeCounterpartyText(value);

  if (!normalizedValue) {
    return undefined;
  }

  for (const term of COUNTERPARTY_STOP_TERMS) {
    normalizedValue = normalizedValue.replace(buildWholeWordRegex(term), ' ');
  }

  normalizedValue = normalizedValue.replace(/\s+/g, ' ').trim();

  return normalizedValue || undefined;
}

export function detectOwnTransfer(input: OwnTransferDetectionInput): boolean | undefined {
  const descriptionText = normalizeCounterpartyText(input.description);
  const counterpartyText = normalizeCounterpartyText(input.counterparty);
  const combinedText = [descriptionText, counterpartyText].filter(Boolean).join(' ').trim();

  if (!combinedText) {
    return undefined;
  }

  if (OWN_TRANSFER_STRONG_TERMS.some((term) => combinedText.includes(term))) {
    return true;
  }

  return undefined;
}

function normalizeCounterpartyText(value?: string): string {
  if (!value) {
    return '';
  }

  return normalizeFingerprintText(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildWholeWordRegex(value: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, 'g');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
