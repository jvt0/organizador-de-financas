import type { AppSetting, ImportTemplate, ImportedFile, Transaction } from '../domain/types';

export const DB_NAME = 'organizador-financas-db';
export const DB_VERSION = 3; // v3: Money Pattern — amount → amountInUnits (inteiro, centavos)

export const DB_STORES = {
  files: 'id, &hash, name, sourceType, uploadedAt',
  transactions:
    'id, &fingerprint, fileId, source, dateTs, direction, amountInUnits, currency, counterpartyNormalized, [fileId+dateTs], [source+dateTs], [direction+dateTs], [counterpartyNormalized+dateTs]',
  templates: 'id, name',
  settings: '&key',
} as const;

export type StoreName = keyof typeof DB_STORES;

export type DatabaseTables = {
  files: ImportedFile;
  transactions: Transaction;
  templates: ImportTemplate;
  settings: AppSetting;
};
