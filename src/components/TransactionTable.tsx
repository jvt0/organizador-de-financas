import { memo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import type { Transaction } from '../domain/types'
import { formatMoney } from '../utils/money'

const ROW_HEIGHT = 44 // px — fixed height para o virtualizer calcular corretamente
const VIRTUALIZE_THRESHOLD = 100 // abaixo disso, renderização direta (sem overhead)

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

// ─── Sub-components (memo'd para evitar re-render desnecessário) ─────────────

const SourceBadge = memo(function SourceBadge({
  source,
}: {
  source: Transaction['source']
}) {
  if (source === 'nubank')
    return (
      <span className="badge-source" style={{ color: '#b892ff', background: '#8c56e618', borderColor: '#8c56e640' }}>
        Nubank
      </span>
    )
  if (source === 'inter')
    return (
      <span className="badge-source" style={{ color: '#ff9966', background: '#ff6b2218', borderColor: '#ff6b2240' }}>
        Inter
      </span>
    )
  return null
})

const OwnTransferBadge = memo(function OwnTransferBadge() {
  return (
    <span
      className="ml-1 badge-source"
      style={{ color: 'var(--color-accent)', background: '#f0c04018', borderColor: '#f0c04050' }}
    >
      própria
    </span>
  )
})

const AmountCell = memo(function AmountCell({ tx }: { tx: Transaction }) {
  const isIn = tx.direction === 'in'
  return (
    <span
      className="font-mono text-xs font-semibold whitespace-nowrap"
      style={{ color: isIn ? 'var(--color-green)' : 'var(--color-red)' }}
    >
      {isIn ? '+' : '−'} {formatMoney(tx.amountInUnits, tx.currency, tx.precision)}
    </span>
  )
})

/**
 * Linha da tabela — React.memo garante que só re-renderiza se a transação mudar.
 * descriptionNormalized é renderizado como texto puro → proteção XSS por construção.
 */
const TransactionRow = memo(function TransactionRow({ tx }: { tx: Transaction }) {
  return (
    <div
      className="grid items-center border-b"
      style={{
        gridTemplateColumns: '100px 1fr 130px 90px 130px',
        height: ROW_HEIGHT,
        borderColor: '#1a1d23',
        backgroundColor: tx.ownTransfer ? '#1a1800' : undefined,
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.backgroundColor = tx.ownTransfer
          ? '#1f1e00'
          : 'var(--color-surface2)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.backgroundColor = tx.ownTransfer
          ? '#1a1800'
          : ''
      }}
    >
      {/* Data */}
      <div className="px-3 font-mono text-xs" style={{ color: 'var(--color-muted)' }}>
        {formatDate(tx.date)}
      </div>

      {/* Descrição — usa descriptionNormalized para UI limpa, raw como tooltip */}
      <div className="px-3 min-w-0">
        <span
          className="block truncate text-xs"
          style={{ color: 'var(--color-text)', maxWidth: '100%' }}
          title={tx.description}
        >
          {tx.descriptionNormalized || tx.description}
        </span>
        {tx.ownTransfer && <OwnTransferBadge />}
      </div>

      {/* Contraparte */}
      <div className="px-3 min-w-0">
        <span
          className="block truncate text-xs"
          style={{ color: 'var(--color-muted)' }}
          title={tx.counterparty}
        >
          {tx.counterparty ?? '—'}
        </span>
      </div>

      {/* Banco */}
      <div className="px-3">
        <SourceBadge source={tx.source} />
      </div>

      {/* Valor */}
      <div className="px-3 text-right">
        <AmountCell tx={tx} />
      </div>
    </div>
  )
})

// ─── Empty / Loading states ────────────────────────────────────────────────
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 gap-3"
    >
      <div className="text-5xl opacity-40">📂</div>
      <p className="font-mono text-base font-semibold" style={{ color: 'var(--color-text)' }}>
        sem transações
      </p>
      <p className="text-sm text-center" style={{ color: 'var(--color-muted)', lineHeight: 1.7 }}>
        Importe um extrato CSV do Inter ou Nubank<br />para começar a análise.
      </p>
    </motion.div>
  )
}

function TableSkeleton() {
  return (
    <div>
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-3 border-b"
          style={{ height: ROW_HEIGHT, borderColor: '#1a1d23' }}
        >
          <div className="animate-pulse rounded h-2.5 w-16" style={{ background: 'var(--color-surface2)' }} />
          <div className="animate-pulse rounded h-2.5 flex-1" style={{ background: 'var(--color-surface2)' }} />
          <div className="animate-pulse rounded h-2.5 w-20" style={{ background: 'var(--color-surface2)' }} />
          <div className="animate-pulse rounded h-2.5 w-14" style={{ background: 'var(--color-surface2)' }} />
          <div className="animate-pulse rounded h-2.5 w-20 ml-auto" style={{ background: 'var(--color-surface2)' }} />
        </div>
      ))}
    </div>
  )
}

// ─── Virtualized body (>VIRTUALIZE_THRESHOLD linhas) ─────────────────────────
function VirtualBody({
  transactions,
  containerHeight,
}: {
  transactions: Transaction[]
  containerHeight: number
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  return (
    <div
      ref={parentRef}
      style={{ height: containerHeight, overflowY: 'auto', overflowX: 'auto' }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}
          >
            <TransactionRow tx={transactions[item.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Direct body (≤VIRTUALIZE_THRESHOLD linhas) ───────────────────────────────
function DirectBody({ transactions }: { transactions: Transaction[] }) {
  return (
    <div style={{ overflowX: 'auto', maxHeight: '66vh', overflowY: 'auto' }}>
      {transactions.map((tx) => (
        <TransactionRow key={tx.id} tx={tx} />
      ))}
    </div>
  )
}

// ─── Table Header ──────────────────────────────────────────────────────────
const HEADER_HEIGHT = 36

function TableHeader({ count }: { count: number }) {
  const cols = ['Data', 'Descrição', 'Contraparte', 'Banco', 'Valor']
  const aligns = ['left', 'left', 'left', 'left', 'right']

  return (
    <div
      className="sticky top-0 z-10 grid border-b"
      style={{
        gridTemplateColumns: '100px 1fr 130px 90px 130px',
        height: HEADER_HEIGHT,
        background: 'var(--color-surface2)',
        borderColor: 'var(--color-border)',
      }}
    >
      {cols.map((col, i) => (
        <div
          key={col}
          className="px-3 flex items-center font-mono text-[10px] font-semibold uppercase tracking-widest"
          style={{
            color: 'var(--color-muted)',
            justifyContent: aligns[i] === 'right' ? 'flex-end' : 'flex-start',
          }}
        >
          {col}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export const TransactionTable = memo(function TransactionTable({
  transactions,
  isLoading,
}: {
  transactions: Transaction[]
  isLoading: boolean
}) {
  const shouldVirtualize = transactions.length > VIRTUALIZE_THRESHOLD
  // Calcula altura do container virtual: 66vh aproximado em pixels
  const VIRTUAL_CONTAINER_HEIGHT =
    typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.66) : 600

  const countLabel = transactions.length.toLocaleString('pt-BR') + ' transação' + (transactions.length !== 1 ? 'ões' : '')

  return (
    <div
      className="rounded-[10px] overflow-hidden border"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Count bar */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <span className="font-mono text-[11px]" style={{ color: 'var(--color-muted)' }}>
          {isLoading ? '…' : countLabel}
        </span>
        {shouldVirtualize && (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded border"
            style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
            virtualizado
          </span>
        )}
      </div>

      {/* Header */}
      <TableHeader count={transactions.length} />

      {/* Body */}
      {isLoading ? (
        <TableSkeleton />
      ) : transactions.length === 0 ? (
        <EmptyState />
      ) : shouldVirtualize ? (
        <VirtualBody
          transactions={transactions}
          containerHeight={VIRTUAL_CONTAINER_HEIGHT}
        />
      ) : (
        <DirectBody transactions={transactions} />
      )}
    </div>
  )
})
