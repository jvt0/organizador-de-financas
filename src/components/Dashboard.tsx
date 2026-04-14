import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useTransactionRepository } from '../hooks/useTransactionRepository'
import { useFiles } from '../hooks/useFiles'
import { useImport } from '../hooks/useImport'
import { SummaryCards } from './SummaryCards'
import { TransactionTable } from './TransactionTable'
import { UploadZone } from './UploadZone'
import {
  ToastContainer,
  buildImportToast,
  buildErrorToast,
  type ToastItem,
} from './ui/Toast'

// ─── Tabs ────────────────────────────────────────────────────────────────────
type Tab = 'transactions' | 'upload'

const TABS: { id: Tab; label: string }[] = [
  { id: 'transactions', label: 'Transações' },
  { id: 'upload', label: '+ Adicionar CSV' },
]

// ─── Header badge ────────────────────────────────────────────────────────────
function HeaderBadge({ count }: { count: number }) {
  const isEmpty = count === 0
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: isEmpty ? 'var(--color-muted)' : 'var(--color-green)',
        background: isEmpty ? 'transparent' : '#4caf7d18',
        border: `1px solid ${isEmpty ? 'var(--color-border)' : '#4caf7d40'}`,
        borderRadius: 5,
        padding: '4px 10px',
        whiteSpace: 'nowrap',
        transition: 'all .3s',
      }}
    >
      {isEmpty ? 'nenhum extrato carregado' : `${count.toLocaleString('pt-BR')} transações`}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('transactions')
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const repo = useTransactionRepository()
  const { files, isLoading: filesLoading } = useFiles()
  const { state, isLocked, importFile, reset } = useImport()

  const prevPhase = useRef<string>('IDLE')

  // Reage às transições de estado da máquina de upload
  useEffect(() => {
    const prev = prevPhase.current
    prevPhase.current = state.phase

    if (state.phase === 'SUCCESS' && prev !== 'SUCCESS') {
      setToasts((t) => [...t, buildImportToast(state.result, state.fileName)])
      // Navega para a tab de transações após sucesso
      setActiveTab('transactions')
      reset()
    }
    if (state.phase === 'ERROR' && prev !== 'ERROR') {
      setToasts((t) => [...t, buildErrorToast(state.message)])
    }
  }, [state, reset])

  const removeToast = useCallback((id: string) => {
    setToasts((t) => t.filter((toast) => toast.id !== id))
  }, [])

  const handleFileDrop = useCallback(
    (file: File) => importFile(file),
    [importFile],
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header — fiel ao reference: "// EXTRATO COMPLETO" em mono */}
      <header
        style={{
          padding: '22px 40px 18px',
          borderBottom: `1px solid var(--color-border)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--color-surface)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--color-accent)',
              whiteSpace: 'nowrap',
            }}
          >
            // EXTRATO COMPLETO
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 2 }}>
            Análise de extratos bancários · Inter e Nubank
          </p>
        </div>
        <HeaderBadge count={repo.summary.totalCount} />
      </header>

      {/* Main */}
      <div style={{ padding: '20px 40px', maxWidth: 1600, margin: '0 auto' }}>
        {/* Tabs — exatamente como no reference HTML */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            marginBottom: 20,
            borderBottom: `1px solid var(--color-border)`,
          }}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 20px',
                  cursor: 'pointer',
                  color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  borderBottom: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                  marginBottom: -1,
                  background: 'none',
                  border: 'none',
                  borderBottomWidth: 2,
                  borderBottomStyle: 'solid',
                  borderBottomColor: active ? 'var(--color-accent)' : 'transparent',
                  transition: 'all .15s',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab: Transações */}
        {activeTab === 'transactions' && (
          <motion.div
            key="transactions"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <SummaryCards summary={repo.summary} isLoading={repo.isLoading} />
            <TransactionTable
              transactions={repo.transactions}
              isLoading={repo.isLoading}
            />
          </motion.div>
        )}

        {/* Tab: Upload — grid 2 colunas como no reference */}
        {activeTab === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <UploadZone
              files={files}
              isFilesLoading={filesLoading}
              state={state}
              isLocked={isLocked}
              onFileDrop={handleFileDrop}
              onDeleteFile={repo.deleteByFile}
            />
          </motion.div>
        )}
      </div>

      {/* Toast container (Framer Motion gerencia entrada/saída) */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
