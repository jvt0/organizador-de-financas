import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Transaction } from '../domain/types'

export type UseTransactionsResult = {
  transactions: Transaction[]
  isLoading: boolean
  count: number
}

export function useTransactions(fileId?: string): UseTransactionsResult {
  const transactions = useLiveQuery(async () => {
    if (fileId) {
      return db.transactions.where('fileId').equals(fileId).sortBy('dateTs')
    }
    return db.transactions.orderBy('dateTs').toArray()
  }, [fileId])

  return {
    transactions: transactions ?? [],
    isLoading: transactions === undefined,
    count: transactions?.length ?? 0,
  }
}
