import { memo } from 'react'
import { motion } from 'framer-motion'
import type { TransactionSummary } from '../hooks/useTransactionRepository'

type SummaryCardsProps = {
  summary: TransactionSummary
  isLoading: boolean
}

type CardDef = {
  label: string
  value: string
  color: string
  dimColor: string
}

function buildCards(s: TransactionSummary): CardDef[] {
  return [
    {
      label: 'movimentação',
      value: s.totalInFormatted,
      color: 'var(--color-accent)',
      dimColor: '#f0c04020',
    },
    {
      label: 'entradas',
      value: s.totalInFormatted,
      color: 'var(--color-green)',
      dimColor: '#4caf7d18',
    },
    {
      label: 'saídas',
      value: s.totalOutFormatted,
      color: 'var(--color-red)',
      dimColor: '#e05c5c18',
    },
    {
      label: 'saldo',
      value: s.netFormatted,
      color: s.netIsPositive ? 'var(--color-green)' : 'var(--color-red)',
      dimColor: s.netIsPositive ? '#4caf7d18' : '#e05c5c18',
    },
  ]
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 320, damping: 28 },
  },
}

function SkeletonCard() {
  return (
    <div
      className="rounded-lg p-4 border"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="animate-pulse rounded h-2 w-20 mb-3" style={{ background: 'var(--color-surface2)' }} />
      <div className="animate-pulse rounded h-5 w-28" style={{ background: 'var(--color-surface2)' }} />
    </div>
  )
}

export const SummaryCards = memo(function SummaryCards({ summary, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
        {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const cards = buildCards(summary)

  return (
    <motion.div
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      key={summary.totalCount} // re-anima ao trocar de dataset
    >
      {cards.map((card) => (
        <motion.div
          key={card.label}
          variants={cardVariants}
          className="rounded-lg p-[15px_17px] border"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          whileHover={{ borderColor: card.color + '60', transition: { duration: 0.15 } }}
        >
          <p
            className="font-mono text-[10px] uppercase tracking-[.8px] mb-[5px]"
            style={{ color: 'var(--color-muted)' }}
          >
            {card.label}
          </p>
          <p className="font-mono text-[19px] font-semibold" style={{ color: card.color }}>
            {summary.totalCount === 0 ? '—' : card.value}
          </p>
        </motion.div>
      ))}
    </motion.div>
  )
})
