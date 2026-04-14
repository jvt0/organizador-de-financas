import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { deleteFile } from '../db/repositories/files.repo'
import type { Transaction } from '../domain/types'
import { formatMoney } from '../utils/money'

export type TransactionSummary = {
  totalCount: number
  totalIn: number          // amountInUnits
  totalOut: number         // amountInUnits
  net: number              // amountInUnits (pode ser negativo)
  totalInFormatted: string
  totalOutFormatted: string
  netFormatted: string
  netIsPositive: boolean
  currency: string
}

export type UseTransactionRepositoryResult = {
  /** Todas as transações, ordenadas por data desc */
  transactions: Transaction[]
  /** Últimas N transações (default 50) para dashboards */
  getLatest: (n?: number) => Transaction[]
  /** Resumo financeiro agregado */
  summary: TransactionSummary
  /** Remove um arquivo e todas as transações vinculadas atomicamente */
  deleteByFile: (fileId: string) => Promise<void>
  isLoading: boolean
}

const EMPTY_SUMMARY: TransactionSummary = {
  totalCount: 0,
  totalIn: 0,
  totalOut: 0,
  net: 0,
  totalInFormatted: formatMoney(0, 'BRL'),
  totalOutFormatted: formatMoney(0, 'BRL'),
  netFormatted: formatMoney(0, 'BRL'),
  netIsPositive: true,
  currency: 'BRL',
}

function computeSummary(transactions: Transaction[]): TransactionSummary {
  if (transactions.length === 0) return EMPTY_SUMMARY

  // Agrupa por moeda — usa BRL como padrão (único suportado v0.2)
  const currency = transactions[0]?.currency ?? 'BRL'
  const precision = transactions[0]?.precision ?? 2

  let totalIn = 0
  let totalOut = 0
  for (const tx of transactions) {
    if (tx.direction === 'in') totalIn += tx.amountInUnits
    else totalOut += tx.amountInUnits
  }
  const net = totalIn - totalOut

  return {
    totalCount: transactions.length,
    totalIn,
    totalOut,
    net,
    totalInFormatted: formatMoney(totalIn, currency, precision),
    totalOutFormatted: formatMoney(totalOut, currency, precision),
    netFormatted: formatMoney(Math.abs(net), currency, precision),
    netIsPositive: net >= 0,
    currency,
  }
}

export function useTransactionRepository(): UseTransactionRepositoryResult {
  // Única query reativa — componentes downstream consomem via métodos do retorno
  const transactions = useLiveQuery(
    () => db.transactions.orderBy('dateTs').reverse().toArray(),
    [],
  )

  const isLoading = transactions === undefined
  const txList: Transaction[] = transactions ?? []

  const summary = useMemo(() => computeSummary(txList), [txList])

  const getLatest = useMemo(
    () => (n = 50) => txList.slice(0, n),
    [txList],
  )

  return {
    transactions: txList,
    getLatest,
    summary,
    deleteByFile: deleteFile,
    isLoading,
  }
}
