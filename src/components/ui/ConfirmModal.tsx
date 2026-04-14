import { motion, AnimatePresence } from 'framer-motion'

type ConfirmModalProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  isDestructive?: boolean
  /** Se true, mostra um spinner no botão de confirmar (optimistic UI) */
  isConfirming?: boolean
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  isDestructive = false,
  isConfirming = false,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            onClick={onCancel}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            style={{
              position: 'relative',
              background: 'var(--color-surface)',
              border: `1px solid var(--color-border)`,
              borderRadius: 12,
              padding: '24px',
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <h2
              id="modal-title"
              style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}
            >
              {title}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.7, marginBottom: 24 }}>
              {description}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onCancel}
                disabled={isConfirming}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  borderRadius: 7,
                  border: `1px solid var(--color-border)`,
                  color: 'var(--color-muted)',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all .15s',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={isConfirming}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 7,
                  border: `1px solid ${isDestructive ? '#e05c5c40' : '#f0c04050'}`,
                  color: isDestructive ? 'var(--color-red)' : 'var(--color-accent)',
                  background: isDestructive ? '#e05c5c18' : '#f0c04018',
                  cursor: isConfirming ? 'not-allowed' : 'pointer',
                  opacity: isConfirming ? 0.7 : 1,
                  transition: 'all .15s',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {isConfirming && (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    style={{ display: 'inline-block', fontSize: 14 }}
                  >
                    ⟳
                  </motion.span>
                )}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
