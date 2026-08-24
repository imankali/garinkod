// frontend/src/components/ui/Modal.tsx

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

import { cn } from '../../utils/cn';
import { acquireScrollLock } from '../../utils/scrollLock';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `sheet` slides up from the bottom — the natural pattern on phones. */
  variant?: 'center' | 'sheet' | 'drawer';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

/**
 * An accessible dialog.
 *
 * Handles the four things hand-rolled modals in this codebase were missing:
 *
 * 1. **Focus trap** — Tab cycles inside the dialog instead of wandering behind
 *    it, which is what makes a modal usable with a keyboard at all.
 * 2. **Focus restore** — closing returns focus to the trigger, so the user does
 *    not get dumped at the top of the page.
 * 3. **Scroll lock** without layout shift, compensating for the scrollbar width.
 * 4. **Escape and backdrop** both close it, and `aria-modal` hides the rest of
 *    the page from screen readers.
 *
 * On small screens the `center` variant automatically becomes a bottom sheet,
 * because a centred dialog on a phone leaves unusable dead space and pushes
 * actions away from the thumb.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'center',
  size = 'md',
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement as HTMLElement;

    // Lock scrolling through the shared counter so several overlays can be
    // open at once without the first one to close unlocking the page.
    const releaseLock = acquireScrollLock();

    // Move focus into the dialog on the next frame, once it is painted.
    const focusTimer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    }, 30);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ).filter((element) => element.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;

      // Wrap around at both ends so focus can never escape the dialog.
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.clearTimeout(focusTimer);
      releaseLock();
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  const isSheet = variant === 'sheet';
  const isDrawer = variant === 'drawer';

  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : isDrawer
      ? {
          initial: { x: '100%' },
          animate: { x: 0 },
          exit: { x: '100%' },
          transition: { type: 'spring' as const, damping: 30, stiffness: 300 },
        }
      : {
          initial: { opacity: 0, y: isSheet ? 40 : 16, scale: isSheet ? 1 : 0.98 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: isSheet ? 40 : 16, scale: isSheet ? 1 : 0.98 },
          transition: { type: 'spring' as const, damping: 28, stiffness: 320 },
        };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex" role="presentation">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          <div
            className={cn(
              'relative z-10 flex w-full',
              isDrawer
                ? 'h-full justify-end'
                : // Centred on desktop, bottom sheet on phones.
                  'items-end justify-center sm:items-center',
            )}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              tabIndex={-1}
              {...panelMotion}
              className={cn(
                'flex w-full flex-col bg-white shadow-2xl outline-none dark:bg-emerald-950',
                isDrawer
                  ? 'h-full max-w-md'
                  : cn(
                      SIZES[size],
                      'max-h-[92dvh] rounded-t-3xl sm:rounded-3xl',
                      isSheet && 'sm:rounded-3xl',
                    ),
                className,
              )}
            >
              <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-emerald-900 sm:p-5">
                <div className="min-w-0">
                  <h2 id={titleId} className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">
                    {title}
                  </h2>
                  {description && (
                    <p id={descriptionId} className="mt-1 text-fluid-xs text-slate-500 dark:text-emerald-200">
                      {description}
                    </p>
                  )}
                </div>
                <IconButton icon={X} label="بستن" onClick={onClose} size="sm" />
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                {children}
              </div>

              {footer && (
                <footer
                  className="border-t border-slate-100 p-4 dark:border-emerald-900 sm:p-5"
                  style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
                >
                  {footer}
                </footer>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
