// frontend/src/components/GlobalMessengerButton.tsx
//
// The floating messenger (پیام‌رسان سراسری). This used to be a
// consultation-only button whose "send us a photo" flow had no API behind it
// and whose only real actions were a phone number and a WhatsApp deep link —
// i.e. it pushed people off the platform to start a conversation the platform
// already supports.
//
// It is now the single global entry point to messaging: it opens the inbox,
// or jumps straight into a service desk (پشتیبانی / مشاوره کشاورزی) as a real
// thread with attachments, so a pest photo is sent *here* and answered here.
// The phone and WhatsApp links stay as a fallback for signed-out visitors.

import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Inbox, LifeBuoy, MessageCircle, Phone, Sprout, X } from 'lucide-react';

import { messagesApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useBackgroundPolling } from '../hooks/useBackgroundPolling';
import { useAuthStore } from '../store/authStore';
import { useDirectStore } from '../store/directStore';
import { cn } from '../utils/cn';

const PHONE_NUMBER = import.meta.env.VITE_PHONE_NUMBER?.trim();
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER?.replace(/\D/g, '');

/** How often the badge refreshes while the button is on screen. */
const UNREAD_POLL_MS = 30000;

/**
 * Routes where the floating button is suppressed.
 *
 * On the messaging screens it sat directly on top of the message composer,
 * hiding the control the page exists for — and offering a second, redundant
 * way to start a conversation.
 */
const HIDDEN_ON = ['/messages', '/checkout'];

export default function GlobalMessengerButton() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { isAuthenticated, isSessionChecked } = useAuthStore();
  const openDirect = useDirectStore((state) => state.openDirect);
  const drawerOpen = useDirectStore((state) => state.open);
  const unreadTotal = useDirectStore((state) => state.unreadTotal);
  const setUnreadTotal = useDirectStore((state) => state.setUnreadTotal);

  const hidden = HIDDEN_ON.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Keep the badge honest even when the drawer is closed: the drawer only
  // polls while it is open, so nothing else would ever notice a new message.
  const refreshUnread = useCallback(async () => {
    try {
      const response = await messagesApi.conversations();
      setUnreadTotal(response.data.unread_total || 0);
    } catch (caught) {
      // Signed-out or offline: leave the last known count alone. A rate limit is
      // rethrown so the shared poll hook pauses rather than stacking errors.
      if (parseApiError(caught).code === 'throttled') throw caught;
    }
  }, [setUnreadTotal]);

  useBackgroundPolling(refreshUnread, UNREAD_POLL_MS, !hidden && isSessionChecked && isAuthenticated);

  // The sheet is a chooser for the drawer; never leave both stacked open.
  useEffect(() => {
    if (drawerOpen) setOpen(false);
  }, [drawerOpen]);

  if (hidden) return null;

  function openInbox() {
    setOpen(false);
    openDirect();
  }

  function openChannel(channel: 'support' | 'consulting') {
    setOpen(false);
    openDirect({ serviceChannel: channel });
  }

  const badge = unreadTotal > 99 ? '۹۹+' : unreadTotal.toLocaleString('fa-IR');

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, type: 'spring' }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen(true)}
        // Sits clear of the fixed mobile bar (and the iOS home indicator)
        // rather than overlapping it, and keeps a full 44px hit area.
        style={{ bottom: 'calc(var(--mobile-nav-clearance) + 0.5rem)' }}
        className="fixed end-4 z-40 flex min-h-12 items-center gap-2 rounded-full bg-brand-gradient px-4 text-white shadow-xl shadow-emerald-900/30 lg:!bottom-6 lg:end-6 dark:shadow-none"
        aria-label={
          unreadTotal > 0
            ? `باز کردن پیام‌رسان، ${badge} پیام خوانده‌نشده`
            : 'باز کردن پیام‌رسان'
        }
      >
        <motion.span
          animate={{ rotate: [0, -12, 12, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }}
        >
          <MessageCircle size={20} />
        </motion.span>
        <span className="hidden text-sm font-bold sm:inline">پیام‌رسان</span>

        {/* Unread count when there is one, otherwise the idle pulse. */}
        {unreadTotal > 0 ? (
          <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-fluid-2xs font-extrabold text-white ring-2 ring-white dark:ring-emerald-950">
            {badge}
          </span>
        ) : (
          <span className="absolute -end-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-lime-400" />
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[85] bg-slate-900/55 backdrop-blur-sm"
              aria-hidden="true"
            />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl sm:inset-x-auto sm:bottom-1/2 sm:start-1/2 sm:translate-x-1/2 sm:translate-y-1/2 dark:bg-emerald-950"
              role="dialog"
              aria-modal="true"
              aria-label="پیام‌رسان گارین‌کود"
            >
              <div className="relative bg-brand-gradient px-5 py-5 text-white">
                <button
                  onClick={() => setOpen(false)}
                  className="tap-target absolute end-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
                  aria-label="بستن"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
                    <MessageCircle size={20} />
                  </span>
                  <div>
                    <p className="font-bold">پیام‌رسان گارین‌کود</p>
                    <p className="text-xs text-white/80">
                      گفتگو با غرفه‌داران، پشتیبانی و کارشناسان کشاورزی
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 p-5">
                {isAuthenticated ? (
                  <>
                    <MessengerAction
                      icon={<Inbox size={18} />}
                      title="همه پیام‌ها"
                      hint="غرفه‌ها، پشتیبانی و پاسخ دیدگاه‌ها در یک صندوق"
                      badge={unreadTotal > 0 ? badge : undefined}
                      onClick={openInbox}
                    />
                    <MessengerAction
                      icon={<LifeBuoy size={18} />}
                      title="پشتیبانی گارین‌کود"
                      hint="سفارش، پرداخت و مشکلات حساب کاربری"
                      onClick={() => openChannel('support')}
                    />
                    <MessengerAction
                      icon={<Sprout size={18} />}
                      title="مشاوره رایگان کشاورزی"
                      hint="عکس آفت یا بیماری را همین‌جا بفرستید"
                      onClick={() => openChannel('consulting')}
                    />

                    <p className="flex items-start gap-2 rounded-2xl bg-emerald-50/70 p-3 text-fluid-xs leading-6 text-slate-600 dark:bg-emerald-900/40 dark:text-emerald-100">
                      <Camera size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-lime-300" />
                      در هر گفتگو می‌توانید عکس، ویدیو و پیام صوتی ارسال کنید.
                    </p>
                  </>
                ) : (
                  <>
                    <MessengerAction
                      icon={<MessageCircle size={18} />}
                      title="ورود به پیام‌رسان"
                      hint="برای گفتگو با غرفه‌داران و کارشناسان وارد شوید"
                      onClick={openInbox}
                    />
                    {PHONE_NUMBER && (
                      <a
                        href={`tel:${PHONE_NUMBER.replace(/[^+\d]/g, '')}`}
                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/50 dark:hover:bg-emerald-900"
                        aria-label={`تماس تلفنی با شماره ${PHONE_NUMBER}`}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0F8A5F] shadow-sm dark:bg-emerald-950 dark:text-lime-300">
                          <Phone size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-700 dark:text-emerald-50">تماس تلفنی مستقیم</span>
                          <span className="block text-xs text-slate-400 dark:text-emerald-300" dir="ltr">{PHONE_NUMBER}</span>
                        </span>
                      </a>
                    )}
                    {WHATSAPP_NUMBER && (
                      <a
                        href={`https://wa.me/${WHATSAPP_NUMBER}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/50 dark:hover:bg-emerald-900"
                        aria-label="گفتگو در واتس‌اپ"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0F8A5F] shadow-sm dark:bg-emerald-950 dark:text-lime-300">
                          <MessageCircle size={18} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-700 dark:text-emerald-50">گفتگو در واتس‌اپ</span>
                          <span className="block text-xs text-slate-400 dark:text-emerald-300">انتقال به واتس‌اپ</span>
                        </span>
                      </a>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/** One row in the messenger sheet. */
function MessengerAction({
  icon,
  title,
  hint,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-start transition-colors',
        'hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/50 dark:hover:bg-emerald-900',
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0F8A5F] shadow-sm dark:bg-emerald-950 dark:text-lime-300">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{title}</span>
        <span className="block text-xs text-slate-400 dark:text-emerald-300">{hint}</span>
      </span>
      {badge && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-fluid-2xs font-extrabold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
