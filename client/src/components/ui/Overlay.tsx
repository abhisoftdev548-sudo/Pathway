import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useEscapeKey } from '@/hooks';

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

/** Accessible modal dialog with entrance/exit transitions. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const reduceMotion = useReducedMotion();
  useScrollLock(open);
  useEscapeKey(open, onClose);

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-heading/40"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Dialog'}
            initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn('relative w-full rounded-xl bg-white shadow-lg', sizeClass)}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-heading">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-body">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-muted hover:bg-surface-muted hover:text-body"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Right-side drawer (mobile navigation, filters). */
export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
  width = 'w-80',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  side?: 'left' | 'right';
  width?: string;
}) {
  const reduceMotion = useReducedMotion();
  useScrollLock(open);
  useEscapeKey(open, onClose);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95]">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-heading/40"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={reduceMotion ? false : { x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: side === 'right' ? '100%' : '-100%' }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
            className={cn(
              'absolute inset-y-0 flex flex-col bg-slate-900 shadow-lg',
              side === 'right' ? 'right-0' : 'left-0',
              width
            )}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-semibold text-heading">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded p-1 text-muted hover:bg-surface-muted hover:text-body"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Confirmation dialog used for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-body hover:bg-surface-muted"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'rounded-lg px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60',
              destructive ? 'bg-danger hover:brightness-95' : 'bg-brand-600 hover:bg-brand-700'
            )}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-body">{message}</div>
    </Modal>
  );
}
