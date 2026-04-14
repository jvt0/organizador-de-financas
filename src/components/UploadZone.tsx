import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ImportedFile } from '../domain/types'
import type { ImportState } from '../hooks/useImport'
import { ConfirmModal } from './ui/ConfirmModal'

type UploadZoneProps = {
  files: ImportedFile[]
  isFilesLoading: boolean
  state: ImportState
  isLocked: boolean
  onFileDrop: (file: File) => Promise<void>
  onDeleteFile: (fileId: string) => Promise<void>
}

// ─── Upload State Machine Visualizer ──────────────────────────────────────────
function StateMachineBar({ state }: { state: ImportState }) {
  const phases: ImportState['phase'][] = ['IDLE', 'UPLOADING', 'PROCESSING', 'SUCCESS']
  const currentIndex = phases.indexOf(state.phase)
  const isError = state.phase === 'ERROR'

  if (state.phase === 'IDLE') return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      style={{ overflow: 'hidden' }}
    >
      {/* Progress bar */}
      <div style={{ background: 'var(--color-surface2)', borderRadius: 4, height: 3, marginBottom: 12, overflow: 'hidden' }}>
        <motion.div
          style={{
            height: '100%',
            borderRadius: 4,
            background: isError ? 'var(--color-red)' : 'var(--color-accent)',
          }}
          initial={{ width: '0%' }}
          animate={{
            width: isError ? '100%'
              : state.phase === 'UPLOADING' ? `${state.progress}%`
              : state.phase === 'PROCESSING' ? '80%'
              : '100%',
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Phase labels */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {isError ? (
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #e05c5c40',
              background: '#e05c5c18',
              color: 'var(--color-red)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              flex: 1,
            }}
          >
            {'message' in state ? state.message : 'Erro desconhecido'}
          </div>
        ) : (
          phases.slice(0, 3).map((phase, i) => {
            const done = currentIndex > i
            const active = currentIndex === i
            return (
              <div
                key={phase}
                style={{
                  padding: '4px 12px',
                  borderRadius: 5,
                  border: `1px solid ${done || active ? '#f0c04050' : 'var(--color-border)'}`,
                  background: done ? '#f0c04018' : active ? '#f0c04010' : 'transparent',
                  color: done || active ? 'var(--color-accent)' : 'var(--color-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all .3s',
                }}
              >
                {done ? '✓' : active ? (
                  <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                    ⟳
                  </motion.span>
                ) : '○'}
                {phase}
              </div>
            )
          })
        )}
      </div>

      {'fileName' in state && state.fileName && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)' }}>
          {state.fileName}
        </p>
      )}
    </motion.div>
  )
}

// ─── Source Badge ──────────────────────────────────────────────────────────────
function SourceBadge({ sourceType }: { sourceType: ImportedFile['sourceType'] }) {
  const cfg = {
    nubank:  { color: '#b892ff', bg: '#8c56e618', border: '#8c56e640', label: 'Nubank' },
    inter:   { color: '#ff9966', bg: '#ff6b2218', border: '#ff6b2240', label: 'Inter' },
    generic: { color: 'var(--color-muted)', bg: 'transparent', border: 'var(--color-border)', label: 'Genérico' },
  }[sourceType] ?? { color: 'var(--color-muted)', bg: 'transparent', border: 'var(--color-border)', label: sourceType }

  return (
    <span
      className="badge-source"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  )
}

// ─── File Row ──────────────────────────────────────────────────────────────────
type FileRowProps = {
  file: ImportedFile
  onDelete: (file: ImportedFile) => void
  isLocked: boolean
  isDeleting: boolean
}

function FileRow({ file, onDelete, isLocked, isDeleting }: FileRowProps) {
  const date = new Date(file.uploadedAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: isDeleting ? 0.4 : 1, x: 0 }}
      exit={{ opacity: 0, x: 12, height: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 7,
        border: `1px solid var(--color-border)`,
        marginBottom: 8,
        background: 'var(--color-bg)',
        filter: isDeleting ? 'grayscale(1)' : undefined,
        transition: 'filter .2s',
      }}
      className="group"
    >
      {/* Icon */}
      <span style={{ fontSize: 18, flexShrink: 0 }}>📄</span>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
          {date}
          {' · '}
          <span style={{ color: 'var(--color-green)' }}>{file.validRowCount} tx</span>
          {file.ignoredRowCount > 0 && (
            <span style={{ color: 'var(--color-muted)' }}> · {file.ignoredRowCount} ign.</span>
          )}
        </p>
      </div>

      <SourceBadge sourceType={file.sourceType} />

      {/* Status badge */}
      <span
        className="uf-status"
        style={{
          background: '#4caf7d18',
          color: 'var(--color-green)',
          border: '1px solid #4caf7d40',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          padding: '2px 8px',
          borderRadius: 4,
          flexShrink: 0,
        }}
      >
        ok
      </span>

      {/* Remove */}
      {isDeleting ? (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          style={{ fontSize: 16, color: 'var(--color-muted)', flexShrink: 0 }}
        >
          ⟳
        </motion.span>
      ) : (
        <button
          onClick={() => onDelete(file)}
          disabled={isLocked}
          style={{
            color: 'var(--color-muted)',
            background: 'none',
            border: 'none',
            fontSize: 16,
            padding: '2px 6px',
            borderRadius: 4,
            cursor: isLocked ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'all .15s',
          }}
          onMouseEnter={(e) => { ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-red)'; ;(e.currentTarget as HTMLButtonElement).style.background = '#e05c5c18' }}
          onMouseLeave={(e) => { ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)'; ;(e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          aria-label={`Remover ${file.name}`}
          title="Remover arquivo e transações"
        >
          ×
        </button>
      )}
    </motion.div>
  )
}

// ─── Drop Zone ─────────────────────────────────────────────────────────────────
function DropZone({
  isLocked,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  inputRef,
  onFileInput,
}: {
  isLocked: boolean
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onClick: () => void
  inputRef: React.RefObject<HTMLInputElement>
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <motion.div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      role="button"
      tabIndex={0}
      aria-disabled={isLocked}
      animate={isDragOver ? { scale: 1.01 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        border: `2px dashed ${isDragOver ? 'var(--color-accent)' : 'var(--color-border)'}`,
        borderRadius: 12,
        padding: '48px 32px',
        textAlign: 'center',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        background: isDragOver ? '#1a1800' : 'var(--color-surface)',
        transition: 'border-color .2s, background .2s',
        opacity: isLocked ? 0.6 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={onFileInput}
        disabled={isLocked}
        aria-label="Selecionar arquivo CSV"
      />

      <motion.div
        animate={{ color: isDragOver ? 'var(--color-accent)' : 'var(--color-muted)' }}
        style={{ fontSize: 36, marginBottom: 12, opacity: 0.6 }}
      >
        ⬆
      </motion.div>

      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
        {isDragOver ? 'Solte para importar' : 'Arraste o extrato CSV'}
      </p>
      <p style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.6 }}>
        ou clique para selecionar
      </p>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {['Inter', 'Nubank', 'máx. 10 MB'].map((label) => (
          <span
            key={label}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 4,
              border: `1px solid var(--color-border)`,
              color: 'var(--color-muted)',
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function UploadZone({ files, isFilesLoading, state, isLocked, onFileDrop, onDeleteFile }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ImportedFile | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null!)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (isLocked) return
    const file = e.dataTransfer.files[0]
    if (file) void onFileDrop(file)
  }, [isLocked, onFileDrop])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void onFileDrop(file)
    e.target.value = ''
  }, [onFileDrop])

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete) return
    setIsConfirming(true)
    // Optimistic UI: marca como "deletando" imediatamente
    setDeletingId(pendingDelete.id)
    setPendingDelete(null)
    try {
      await onDeleteFile(pendingDelete.id)
    } catch (err) {
      console.error('Erro ao remover arquivo:', err)
      setDeletingId(null) // reverte se falhar
    } finally {
      setIsConfirming(false)
      setDeletingId(null)
    }
  }, [pendingDelete, onDeleteFile])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Drop zone */}
      <DropZone
        isLocked={isLocked}
        isDragOver={isDragOver}
        onDragOver={(e) => { e.preventDefault(); if (!isLocked) setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isLocked && inputRef.current?.click()}
        inputRef={inputRef}
        onFileInput={handleFileInput}
      />

      {/* State machine visualizer */}
      <AnimatePresence>
        {state.phase !== 'IDLE' && (
          <StateMachineBar key="state-bar" state={state} />
        )}
      </AnimatePresence>

      {/* File list */}
      {(files.length > 0 || isFilesLoading) && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: `1px solid var(--color-border)`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '.8px',
              marginBottom: 14,
            }}
          >
            arquivos importados
            <span style={{ marginLeft: 8, color: 'var(--color-border)', fontWeight: 400 }}>
              [{files.length}]
            </span>
          </p>

          {isFilesLoading ? (
            <p style={{ color: 'var(--color-muted)', fontSize: 13, textAlign: 'center', padding: '28px 0' }}>
              Carregando…
            </p>
          ) : (
            <AnimatePresence mode="popLayout">
              {files.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  onDelete={setPendingDelete}
                  isLocked={isLocked}
                  isDeleting={deletingId === file.id}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* How it works */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: `1px solid var(--color-border)`,
          borderRadius: 12,
          padding: 20,
        }}
      >
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 14 }}>
          como funciona
        </p>
        {[
          { n: '01', text: <>Selecione ou arraste um <strong style={{ color: 'var(--color-text)' }}>extrato .csv</strong> do Inter ou Nubank.</> },
          { n: '02', text: <>O sistema <strong style={{ color: 'var(--color-text)' }}>detecta o banco automaticamente</strong> e normaliza as transações.</> },
          { n: '03', text: <>Duplicatas são <strong style={{ color: 'var(--color-text)' }}>ignoradas automaticamente</strong> por fingerprint.</> },
        ].map(({ n, text }) => (
          <div key={n} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
              color: 'var(--color-accent)', background: '#f0c04018', border: '1px solid #f0c04050',
              borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, marginTop: 1,
            }}>
              {n}
            </span>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6 }}>{text}</p>
          </div>
        ))}
      </div>

      {/* Confirm delete modal */}
      <ConfirmModal
        open={pendingDelete !== null}
        title="Remover arquivo?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" e todas as ${pendingDelete.validRowCount} transações vinculadas serão removidas permanentemente. Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        isDestructive
        isConfirming={isConfirming}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
