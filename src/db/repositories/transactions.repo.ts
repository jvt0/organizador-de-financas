import { db, type Transaction } from '../db';

export const transactionsRepo = {
  // Busca todas para o Front-end
  async findAll(): Promise<Transaction[]> {
    return db.transactions.orderBy('dateTs').reverse().toArray();
  },

  // Grava as transações injetando no banco de forma atômica
  async saveAll(transactions: Transaction[]): Promise<void> {
    // Usamos bulkPut porque se o ID (fingerprint) já existir, ele só sobrescreve
    // Isso evita o erro de "ConstraintError" por IDs duplicados
    await db.transactions.bulkPut(transactions);
  },

  async clearAll(): Promise<void> {
    await db.transactions.clear();
    await db.files.clear();
  }
};