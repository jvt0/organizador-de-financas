import type { AppSetting, ImportTemplate, ImportedFile, Transaction } from '../domain/types';

export const DB_NAME = 'organizador-financas-db';
export const DB_VERSION = 2;

export const DB_STORES = {
  files: 'id, &hash, name, sourceType, uploadedAt',
  transactions:
    'id, &fingerprint, fileId, source, dateTs, direction, amount, counterpartyNormalized, [fileId+dateTs], [source+dateTs], [direction+dateTs], [counterpartyNormalized+dateTs]',
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
