import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ImportResult } from '../../pipeline/import.pipeline'

type ToastVariant = 'success' | 'error' | 'info'

type ToastProps = {
  id: string
  variant: ToastVariant
  title: string
  message?: string
  onClose: () => void
  durationMs?: number
}

const DOT_COLORS: Record<ToastVariant, string> = {
  success: 'var(--color-green)',
  error: 'var(--color-red)',
  info: 'var(--color-blue)',
}

const BORDER_COLORS: Record<ToastVariant, string> = {
  success: '#4caf7d40',
  error: '#e05c5c40',
  info: '#5b9cf640',
}

export function Toast({ id, variant, title, message, onClose, durationMs = 5000 }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    timerRef.current = setTimeout(onClose, durationMs)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [onClose, durationMs])

  return (
    <motion.div
      key={id}
      layout
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      role="alert"
      style={{
        background: 'var(--color-surface2)',
        border: `1px solid ${BORDER_COLORS[variant]}`,
        borderRadius: 8,
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        maxWidth: 360,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        pointerEvents: 'auto',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: DOT_COLORS[variant],
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--color-text)', fontWeight: 600, margin: 0 }}>{title}</p>
        {message && (
          <p style={{ color: 'var(--color-muted)', marginTop: 2, lineHeight: 1.5 }}>{message}</p>
        )}
      </div>
      <button
        onClick={onClose}
        style={{
          color: 'var(--color-muted)',
          background: 'none',
          border: 'none',
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
          flexShrink: 0,
          padding: '0 2px',
        }}
        aria-label="Fechar"
      >
        ×
      </button>
    </motion.div>
  )
}

// ─── Toast container (AnimatePresence gerencia entrada e saída) ───────────────
export type ToastItem = {
  id: string
  variant: ToastVariant
  title: string
  message?: string
}

type ToastContainerProps = {
  toasts: ToastItem[]
  onClose: (id: string) => void
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onClose={() => onClose(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── Convenience builder ──────────────────────────────────────────────────────
export function buildImportToast(result: ImportResult, fileName: string): ToastItem {
  const newPart = `${result.newCount} nova${result.newCount !== 1 ? 's' : ''}`
  const dupPart =
    result.duplicateCount > 0 ? ` · ${result.duplicateCount} duplicadas ignoradas` : ''

  return {
    id: crypto.randomUUID(),
    variant: 'success',
    title: fileName,
    message: `${newPart}${dupPart}`,
  }
}

export function buildErrorToast(message: string): ToastItem {
  return {
    id: crypto.randomUUID(),
    variant: 'error',
    title: 'Erro na importação',
    message,
  }
}
