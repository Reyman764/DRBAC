import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onCancel}
        >
          <motion.div
            className="modal"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <h2 id="confirm-modal-title" className="panel-title">{title}</h2>
              <button type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>
            </div>
            <div className="modal-body">
              <p className="subtitle" style={{ margin: 0 }}>{message}</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 22 }}>
                <button type="button" className="btn" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
                <button
                  type="button"
                  className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={onConfirm}
                  disabled={busy}
                >
                  {busy ? 'Please wait…' : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
