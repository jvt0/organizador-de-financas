import Dexie, { type Table } from 'dexie';

import type { AppSetting, ImportTemplate, ImportedFile, Transaction } from '../domain/types';
import { DB_NAME, DB_STORES, DB_VERSION } from './schema';

export class OrganizadorFinancasDB extends Dexie {
  files!: Table<ImportedFile, string>;
  transactions!: Table<Transaction, string>;
  templates!: Table<ImportTemplate, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super(DB_NAME);

    this.version(DB_VERSION).stores(DB_STORES);
  }
}

export const db = new OrganizadorFinancasDB();
