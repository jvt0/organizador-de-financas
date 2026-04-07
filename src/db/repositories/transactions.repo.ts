import type { Transaction } from '../../domain/types';

export type TransactionsRepository = {
  list(): Promise<Transaction[]>;
};

export const transactionsRepository: TransactionsRepository = {
  async list() {
    throw new Error('transactionsRepository.list is not implemented yet.');
  },
};
