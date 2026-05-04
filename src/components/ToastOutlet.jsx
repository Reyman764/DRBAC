import { AnimatePresence, motion } from 'framer-motion';

function toastIcon(type) {
  if (type === 'success') return '✓';
  if (type === 'error') return '!';
  return '·';
}

/**
 * Anchors toast to top-center using flexbox so Framer does not overwrite translateX(-50%).
 */
export default function ToastOutlet({ toast }) {
  return (
    <div className="toast-anchor" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`toast toast-${toast.type} toast-motion`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <span className="toast-icon" aria-hidden>{toastIcon(toast.type)}</span>
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
